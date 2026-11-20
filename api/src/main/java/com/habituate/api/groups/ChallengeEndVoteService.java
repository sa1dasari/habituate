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
    private final ChallengeEndVoteBallotRepository responseRepository;
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
            ChallengeEndVoteBallotRepository responseRepository,
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
            // resolvedAt is set by every path this service writes (maybeResolveByMajority,
            // closeAsFailed) whenever outcome is set, but ddl-auto=update gives no DB-level
            // guarantee of that pairing — fall back to closesAt rather than NPE on a legacy row.
            Instant resolvedAt = previous.getResolvedAt() != null ? previous.getResolvedAt() : previous.getClosesAt();
            Instant cooldownEnds = resolvedAt.plus(COOLDOWN);
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
        responseRepository.save(new ChallengeEndVoteBallot(vote.getId(), userId, ChallengeEndVoteBallot.YES));

        maybeResolveByMajority(vote, challenge);

        // If the proposer's own yes already cleared the majority (solo challenge, or a
        // 2-member one), the vote never existed as an "open" thing from anyone else's
        // perspective — skip the opened notification so members don't see "vote opened"
        // followed immediately by "vote ended early" for a vote they never got to see.
        if (vote.getOutcome() == null) {
            String actorName = userLookupService.resolve(userId).displayName();
            List<String> others = participants.stream().map(ChallengeParticipant::getUserId)
                    .filter(id -> !id.equals(userId)).toList();
            notifyAll(others, AppNotification.CHALLENGE_VOTE_OPENED, "Vote: end early?",
                    actorName + " proposed ending \"" + challenge.getName() + "\" early.", challenge.getId());
        }

        return toResponse(voteRepository.findById(vote.getId()).orElseThrow(), userId);
    }

    @Transactional
    public ChallengeVoteResponse respond(String userId, Long challengeId, Long voteId, String response) {
        if (!ChallengeEndVoteBallot.YES.equals(response) && !ChallengeEndVoteBallot.NO.equals(response)) {
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

        responseRepository.save(new ChallengeEndVoteBallot(voteId, userId, response));
        maybeResolveByMajority(vote, challenge);

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
     * the numerator while still counting toward the denominator. totalEligible is always
     * derived here from the voter snapshot itself, never passed in, so a future caller
     * can't accidentally substitute a live participant count and break that rule. */
    private void maybeResolveByMajority(ChallengeEndVote vote, Challenge challenge) {
        int totalEligible = voterRepository.findByVoteId(vote.getId()).size();
        if (totalEligible <= 0) {
            return;
        }
        long yesCount = responseRepository.countByVoteIdAndResponse(vote.getId(), ChallengeEndVoteBallot.YES);
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
     * majority reached — the vote fails and the challenge keeps going. Takes the
     * scheduler's own clock reading for resolvedAt rather than reading Instant.now()
     * itself, so a test driving the scheduler with a fixed Instant actually controls
     * the cooldown window it produces instead of that window silently following the
     * real wall clock. */
    @Transactional
    public void closeAsFailed(ChallengeEndVote vote, Instant now) {
        Challenge challenge = challengeRepository.findById(vote.getChallengeId()).orElse(null);
        long yesCount = responseRepository.countByVoteIdAndResponse(vote.getId(), ChallengeEndVoteBallot.YES);
        int totalEligible = voterRepository.findByVoteId(vote.getId()).size();

        vote.setOutcome(ChallengeEndVote.FAILED);
        vote.setResolvedAt(now);
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
        long yesCount = responseRepository.countByVoteIdAndResponse(vote.getId(), ChallengeEndVoteBallot.YES);
        int totalEligible = voterRepository.findByVoteId(vote.getId()).size();
        boolean eligible = voterRepository.existsByVoteIdAndUserId(vote.getId(), viewingUserId);
        String myResponse = responseRepository.findByVoteIdAndUserId(vote.getId(), viewingUserId)
                .map(ChallengeEndVoteBallot::getResponse).orElse(null);
        boolean canVote = eligible && vote.getOutcome() == null && myResponse == null;
        return new ChallengeVoteResponse(
                vote.getId(), vote.getChallengeId(), vote.getProposedBy(),
                userLookupService.resolve(vote.getProposedBy()).displayName(),
                vote.getOpenedAt(), vote.getClosesAt(), vote.getOutcome(),
                (int) yesCount, totalEligible, myResponse, eligible, canVote);
    }
}
