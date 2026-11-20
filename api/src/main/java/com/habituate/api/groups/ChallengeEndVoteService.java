package com.habituate.api.groups;

import com.habituate.api.common.ForbiddenException;
import com.habituate.api.notifications.AppNotification;
import com.habituate.api.notifications.AppNotificationService;
import com.habituate.api.notifications.ExpoPushMessage;
import com.habituate.api.notifications.ExpoPushService;
import com.habituate.api.notifications.PushToken;
import com.habituate.api.notifications.PushTokenRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * "End early" voting on a Challenge that has already reached its target
 * (owner decision, design-review thread 2026-11-20): any member can open a
 * 24-hour vote; it passes the moment more than half of the snapshotted
 * eligible members vote yes (checked here, in respond(), not deferred to a
 * scheduler); otherwise ChallengeEndVoteCloseScheduler fails it at closesAt.
 * A missing vote counts as no by construction — the majority check divides
 * by the full eligible-voter snapshot, not the count of responses cast.
 *
 * Deliberately does NOT handle a challenge reaching its periodEnd while a
 * vote is still open (the owner's "close it as moot" rule) — that requires
 * the periodEnd scheduled job, which is separate, not-yet-approved scope.
 * An open vote on a challenge that reaches periodEnd will sit unresolved
 * until ChallengeEndVoteCloseScheduler closes it at its own closesAt
 * (FAILED) — flagged here rather than silently built as if the interaction
 * were handled.
 */
@Service
public class ChallengeEndVoteService {

    private static final Duration VOTE_WINDOW = Duration.ofHours(24);
    private static final Duration COOLDOWN = Duration.ofHours(24);

    private final ChallengeService challengeService;
    private final ChallengeRepository challengeRepository;
    private final ChallengeParticipantRepository participantRepository;
    private final ChallengeEndVoteRepository voteRepository;
    private final ChallengeEndVoteVoterRepository voterRepository;
    private final ChallengeEndVoteResponseRepository responseRepository;
    private final UserLookupService userLookupService;
    private final PushTokenRepository pushTokenRepository;
    private final ExpoPushService expoPushService;
    private final AppNotificationService appNotificationService;

    public ChallengeEndVoteService(
            ChallengeService challengeService,
            ChallengeRepository challengeRepository,
            ChallengeParticipantRepository participantRepository,
            ChallengeEndVoteRepository voteRepository,
            ChallengeEndVoteVoterRepository voterRepository,
            ChallengeEndVoteResponseRepository responseRepository,
            UserLookupService userLookupService,
            PushTokenRepository pushTokenRepository,
            ExpoPushService expoPushService,
            AppNotificationService appNotificationService) {
        this.challengeService = challengeService;
        this.challengeRepository = challengeRepository;
        this.participantRepository = participantRepository;
        this.voteRepository = voteRepository;
        this.voterRepository = voterRepository;
        this.responseRepository = responseRepository;
        this.userLookupService = userLookupService;
        this.pushTokenRepository = pushTokenRepository;
        this.expoPushService = expoPushService;
        this.appNotificationService = appNotificationService;
    }

    @Transactional
    public ChallengeVoteResponse openVote(String userId, Long challengeId) {
        Challenge challenge = challengeService.requireParticipant(userId, challengeId);
        if (challenge.getEndedAt() != null) {
            throw new IllegalArgumentException("This challenge has already ended.");
        }
        int target = challenge.getTargetCount() == null ? 1 : challenge.getTargetCount();
        if (challengeService.totalBuilt(challenge) < target) {
            throw new IllegalArgumentException("An end-early vote can only start once the target is reached.");
        }

        ChallengeEndVote previous = voteRepository.findFirstByChallengeIdOrderByOpenedAtDesc(challengeId).orElse(null);
        if (previous != null) {
            if (previous.getOutcome() == null) {
                throw new IllegalArgumentException("A vote is already open for this challenge.");
            }
            Instant cooldownEnds = previous.getResolvedAt().plus(COOLDOWN);
            if (Instant.now().isBefore(cooldownEnds)) {
                throw new IllegalArgumentException(
                        "A new vote can't start until 24 hours after the last one closed.");
            }
        }

        Instant now = Instant.now();
        ChallengeEndVote vote = voteRepository.save(new ChallengeEndVote(challengeId, userId, now, now.plus(VOTE_WINDOW)));

        List<ChallengeParticipant> participants = participantRepository.findByChallengeId(challengeId);
        for (ChallengeParticipant p : participants) {
            voterRepository.save(new ChallengeEndVoteVoter(vote.getId(), p.getUserId()));
        }
        // "Starting the vote is their yes" (owner decision) — the proposer's
        // own response is recorded immediately, same as anyone else's.
        responseRepository.save(new ChallengeEndVoteResponse(vote.getId(), userId, ChallengeEndVoteResponse.YES));

        maybeResolveByMajority(vote, challenge, participants.size());

        String actorName = userLookupService.resolve(userId).displayName();
        List<String> others = participants.stream().map(ChallengeParticipant::getUserId)
                .filter(id -> !id.equals(userId)).toList();
        notifyAll(others, AppNotification.CHALLENGE_VOTE_OPENED, "Vote: end early?",
                actorName + " proposed ending \"" + challenge.getName() + "\" early.", challenge.getId());

        return toResponse(voteRepository.findById(vote.getId()).orElseThrow(), userId);
    }

    @Transactional
    public ChallengeVoteResponse respond(String userId, Long challengeId, Long voteId, String response) {
        if (!ChallengeEndVoteResponse.YES.equals(response) && !ChallengeEndVoteResponse.NO.equals(response)) {
            throw new IllegalArgumentException("response must be YES or NO");
        }
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found: " + challengeId));
        ChallengeEndVote vote = voteRepository.findById(voteId)
                .filter(v -> v.getChallengeId().equals(challengeId))
                .orElseThrow(() -> new EntityNotFoundException("Vote not found: " + voteId));
        if (!voterRepository.existsByVoteIdAndUserId(voteId, userId)) {
            throw new ForbiddenException("You weren't a member of this challenge when the vote opened.");
        }
        if (vote.getOutcome() != null) {
            throw new IllegalArgumentException("This vote has already closed.");
        }
        if (responseRepository.existsByVoteIdAndUserId(voteId, userId)) {
            throw new IllegalArgumentException("You already voted on this.");
        }

        responseRepository.save(new ChallengeEndVoteResponse(voteId, userId, response));
        int totalEligible = voterRepository.findByVoteId(voteId).size();
        maybeResolveByMajority(vote, challenge, totalEligible);

        return toResponse(voteRepository.findById(voteId).orElseThrow(), userId);
    }

    public ChallengeVoteResponse latest(String userId, Long challengeId) {
        challengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("Challenge not found: " + challengeId));
        ChallengeEndVote vote = voteRepository.findFirstByChallengeIdOrderByOpenedAtDesc(challengeId).orElse(null);
        return vote == null ? null : toResponse(vote, userId);
    }

    /** Closes the vote PASSED the moment more than half of every snapshotted eligible
     * voter has said yes — a missing vote counts as no simply by not contributing to
     * the numerator while still counting toward the denominator. */
    private void maybeResolveByMajority(ChallengeEndVote vote, Challenge challenge, int totalEligible) {
        if (totalEligible <= 0) {
            return;
        }
        long yesCount = responseRepository.countByVoteIdAndResponse(vote.getId(), ChallengeEndVoteResponse.YES);
        if (yesCount * 2 > totalEligible) {
            vote.setOutcome(ChallengeEndVote.PASSED);
            vote.setResolvedAt(Instant.now());
            voteRepository.save(vote);

            challenge.setEndedAt(Instant.now());
            challenge.setEndedEarlyByVote(true);
            challengeRepository.save(challenge);

            List<String> everyone = participantRepository.findByChallengeId(challenge.getId()).stream()
                    .map(ChallengeParticipant::getUserId).toList();
            notifyAll(everyone, AppNotification.CHALLENGE_VOTE_ENDED_EARLY,
                    "\"" + challenge.getName() + "\" ended early",
                    yesCount + " of " + totalEligible + " voted yes. See the landmark.", challenge.getId());
        }
    }

    /** ChallengeEndVoteCloseScheduler calls this once closesAt has passed with no
     * majority reached — the vote fails and the challenge keeps going. */
    @Transactional
    public void closeAsFailed(ChallengeEndVote vote) {
        Challenge challenge = challengeRepository.findById(vote.getChallengeId()).orElse(null);
        long yesCount = responseRepository.countByVoteIdAndResponse(vote.getId(), ChallengeEndVoteResponse.YES);
        int totalEligible = voterRepository.findByVoteId(vote.getId()).size();

        vote.setOutcome(ChallengeEndVote.FAILED);
        vote.setResolvedAt(Instant.now());
        voteRepository.save(vote);

        if (challenge == null) {
            return;
        }
        List<String> everyone = participantRepository.findByChallengeId(challenge.getId()).stream()
                .map(ChallengeParticipant::getUserId).toList();
        notifyAll(everyone, AppNotification.CHALLENGE_VOTE_FAILED, "The vote to end early didn't pass",
                yesCount + " of " + totalEligible + " said yes. \"" + challenge.getName() + "\" keeps going.",
                challenge.getId());
    }

    /** Best-effort fan-out, same convention as ChallengeService's own notifyOtherParticipantsOfCheckIn —
     * a notification/push failure must never roll back the vote state change that triggered it. */
    private void notifyAll(List<String> userIds, String type, String title, String body, Long challengeId) {
        appNotificationService.notifyAll(userIds, type, title, body, null, challengeId, null);

        List<ExpoPushMessage> messages = new ArrayList<>();
        for (String userId : userIds) {
            for (PushToken token : pushTokenRepository.findByUserId(userId)) {
                messages.add(new ExpoPushMessage(token.getToken(), title, body, Map.of("challengeId", challengeId)));
            }
        }
        if (!messages.isEmpty()) {
            expoPushService.send(messages);
        }
    }

    private ChallengeVoteResponse toResponse(ChallengeEndVote vote, String viewingUserId) {
        long yesCount = responseRepository.countByVoteIdAndResponse(vote.getId(), ChallengeEndVoteResponse.YES);
        int totalEligible = voterRepository.findByVoteId(vote.getId()).size();
        boolean eligible = voterRepository.existsByVoteIdAndUserId(vote.getId(), viewingUserId);
        String myResponse = responseRepository.findByVoteIdAndUserId(vote.getId(), viewingUserId)
                .map(ChallengeEndVoteResponse::getResponse).orElse(null);
        boolean canVote = eligible && vote.getOutcome() == null && myResponse == null;
        return new ChallengeVoteResponse(
                vote.getId(), vote.getChallengeId(), vote.getProposedBy(),
                userLookupService.resolve(vote.getProposedBy()).displayName(),
                vote.getOpenedAt(), vote.getClosesAt(), vote.getOutcome(),
                (int) yesCount, totalEligible, myResponse, eligible, canVote);
    }
}
