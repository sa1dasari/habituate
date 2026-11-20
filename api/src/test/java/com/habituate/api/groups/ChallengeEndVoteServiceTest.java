package com.habituate.api.groups;

import com.habituate.api.common.ForbiddenException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
class ChallengeEndVoteServiceTest {

    @Autowired
    private ChallengeService challengeService;

    @Autowired
    private ChallengeEndVoteService voteService;

    @Autowired
    private ChallengeEndVoteCloseScheduler closeScheduler;

    @Autowired
    private ChallengeRepository challengeRepository;

    @Autowired
    private ChallengeParticipantRepository participantRepository;

    @Autowired
    private ChallengeCheckInRepository checkInRepository;

    @Autowired
    private ChallengeEndVoteRepository voteRepository;

    @Autowired
    private ChallengeEndVoteVoterRepository voterRepository;

    @Autowired
    private ChallengeEndVoteResponseRepository responseRepository;

    @MockBean
    private UserLookupService userLookupService;

    @MockBean
    private FriendshipService friendshipService;

    private Long challengeId;

    @AfterEach
    void cleanup() {
        if (challengeId != null) {
            for (ChallengeEndVote vote : voteRepository.findAll()) {
                if (vote.getChallengeId().equals(challengeId)) {
                    responseRepository.findByVoteId(vote.getId()).forEach(r -> responseRepository.deleteById(r.getId()));
                    voterRepository.findByVoteId(vote.getId()).forEach(v -> voterRepository.deleteById(v.getId()));
                    voteRepository.deleteById(vote.getId());
                }
            }
            checkInRepository.findAll().stream()
                    .filter(c -> c.getChallengeId().equals(challengeId))
                    .forEach(c -> checkInRepository.deleteById(c.getId()));
            participantRepository.findByChallengeId(challengeId).forEach(p -> participantRepository.deleteById(p.getId()));
            challengeRepository.deleteById(challengeId);
        }
    }

    private void stubResolve() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User " + inv.getArgument(0), null, null));
    }

    private CreateChallengeRequest basicRequest(String name, Integer targetCount) {
        return new CreateChallengeRequest(
                name, "Do it every day", targetCount, "2026-01-01", "2026-12-31", null,
                null, null, null, null, null, null, null);
    }

    /** Creates a challenge with the given target, joins the other members, and has
     * enough of them log once today so the total reaches the target (each BOOLEAN log
     * counts as 1) — the precondition every openVote() call needs. */
    private Long setUpReadyChallenge(String creator, Integer target, String... otherMembers) {
        ChallengeResponse created = challengeService.create(creator, basicRequest("Vote Test " + creator, target), "UTC");
        challengeId = created.id();
        for (String member : otherMembers) {
            challengeService.join(member, challengeId, "UTC");
        }
        int built = 0;
        challengeService.logCheckIn(creator, challengeId, null, "UTC");
        built++;
        for (String member : otherMembers) {
            if (built >= target) break;
            challengeService.logCheckIn(member, challengeId, null, "UTC");
            built++;
        }
        return challengeId;
    }

    @Test
    void openVote_threeOfFour_passesImmediately() {
        stubResolve();
        setUpReadyChallenge("vote-user-1a", 2, "vote-user-1b", "vote-user-1c", "vote-user-1d");

        ChallengeVoteResponse vote = voteService.openVote("vote-user-1a", challengeId);
        assertThat(vote.outcome()).isNull();
        assertThat(vote.yesCount()).isEqualTo(1);
        assertThat(vote.totalEligible()).isEqualTo(4);

        voteService.respond("vote-user-1b", challengeId, vote.id(), ChallengeEndVoteResponse.YES);
        ChallengeVoteResponse afterSecond = voteService.respond("vote-user-1c", challengeId, vote.id(), ChallengeEndVoteResponse.YES);

        assertThat(afterSecond.outcome()).isEqualTo(ChallengeEndVote.PASSED);
        assertThat(afterSecond.yesCount()).isEqualTo(3);
        Challenge ended = challengeRepository.findById(challengeId).orElseThrow();
        assertThat(ended.getEndedAt()).isNotNull();
        assertThat(ended.isEndedEarlyByVote()).isTrue();
    }

    @Test
    void openVote_twoOfFour_doesNotPass() {
        stubResolve();
        setUpReadyChallenge("vote-user-2a", 2, "vote-user-2b", "vote-user-2c", "vote-user-2d");

        ChallengeVoteResponse vote = voteService.openVote("vote-user-2a", challengeId);
        ChallengeVoteResponse afterSecond = voteService.respond("vote-user-2b", challengeId, vote.id(), ChallengeEndVoteResponse.YES);

        assertThat(afterSecond.outcome()).isNull();
        assertThat(afterSecond.yesCount()).isEqualTo(2);
        assertThat(afterSecond.totalEligible()).isEqualTo(4);
        Challenge stillOpen = challengeRepository.findById(challengeId).orElseThrow();
        assertThat(stillOpen.getEndedAt()).isNull();
    }

    @Test
    void missingVotesCountAsNo_closeSchedulerFailsAtDeadline() {
        stubResolve();
        setUpReadyChallenge("vote-user-3a", 2, "vote-user-3b", "vote-user-3c", "vote-user-3d");

        ChallengeVoteResponse vote = voteService.openVote("vote-user-3a", challengeId);
        voteService.respond("vote-user-3b", challengeId, vote.id(), ChallengeEndVoteResponse.NO);
        // vote-user-3c and vote-user-3d never vote at all — 1 yes of 4, no majority.

        closeScheduler.closeExpired(Instant.now().plusSeconds(25 * 3600));

        ChallengeEndVote resolved = voteRepository.findById(vote.id()).orElseThrow();
        assertThat(resolved.getOutcome()).isEqualTo(ChallengeEndVote.FAILED);
        Challenge stillOpen = challengeRepository.findById(challengeId).orElseThrow();
        assertThat(stillOpen.getEndedAt()).isNull();
    }

    @Test
    void joinAfterVoteOpens_cannotVote() {
        stubResolve();
        setUpReadyChallenge("vote-user-4a", 1, "vote-user-4b");

        ChallengeVoteResponse vote = voteService.openVote("vote-user-4a", challengeId);
        challengeService.join("vote-user-4c", challengeId, "UTC");

        assertThatThrownBy(() -> voteService.respond("vote-user-4c", challengeId, vote.id(), ChallengeEndVoteResponse.YES))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void nonMember_cannotVote() {
        stubResolve();
        setUpReadyChallenge("vote-user-5a", 2, "vote-user-5b", "vote-user-5c", "vote-user-5d");

        ChallengeVoteResponse vote = voteService.openVote("vote-user-5a", challengeId);

        assertThatThrownBy(() -> voteService.respond("vote-user-5-never-joined", challengeId, vote.id(), ChallengeEndVoteResponse.YES))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void cooldown_blocksANewVoteWithin24HoursOfTheLastOneClosing() {
        stubResolve();
        setUpReadyChallenge("vote-user-6a", 2, "vote-user-6b", "vote-user-6c", "vote-user-6d");

        ChallengeVoteResponse vote = voteService.openVote("vote-user-6a", challengeId);
        voteService.respond("vote-user-6b", challengeId, vote.id(), ChallengeEndVoteResponse.NO);
        closeScheduler.closeExpired(Instant.now().plusSeconds(25 * 3600));

        assertThatThrownBy(() -> voteService.openVote("vote-user-6a", challengeId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("24 hours");
    }
}
