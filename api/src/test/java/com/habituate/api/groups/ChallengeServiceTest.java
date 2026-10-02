package com.habituate.api.groups;

import com.habituate.api.common.ForbiddenException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
class ChallengeServiceTest {

    @Autowired
    private ChallengeService challengeService;

    @Autowired
    private ChallengeRepository challengeRepository;

    @Autowired
    private ChallengeParticipantRepository participantRepository;

    @MockBean
    private UserLookupService userLookupService;

    private Long challengeId;

    @AfterEach
    void cleanup() {
        if (challengeId != null) {
            participantRepository.findByChallengeId(challengeId).forEach(p -> participantRepository.deleteById(p.getId()));
            challengeRepository.deleteById(challengeId);
        }
    }

    private void stubResolve() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User " + inv.getArgument(0), null));
    }

    @Test
    void create_autoJoinsCreatorWithZeroProgress() {
        stubResolve();
        ChallengeResponse response = challengeService.create("challenge-test-user-1", new CreateChallengeRequest(
                "Morning Routine", "Do it every day", 5, "2026-01-01", "2026-01-07"));
        challengeId = response.id();

        assertThat(response.joined()).isTrue();
        assertThat(response.myProgress()).isEqualTo(0);
        assertThat(response.progressPercent()).isEqualTo(0);
        assertThat(response.participantCount()).isEqualTo(1);
    }

    @Test
    void create_rejectsEndBeforeStart() {
        assertThatThrownBy(() -> challengeService.create("challenge-test-user-2", new CreateChallengeRequest(
                "Bad Dates", null, 5, "2026-01-07", "2026-01-01")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void join_thenAdjustProgress_updatesMyProgressOnly() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-3a", new CreateChallengeRequest(
                "Shared Goal", null, 5, "2026-01-01", "2026-01-07"));
        challengeId = created.id();

        challengeService.join("challenge-test-user-3b", challengeId);
        ChallengeResponse afterProgress = challengeService.adjustProgress(
                "challenge-test-user-3b", challengeId, new ChallengeProgressRequest(3));

        assertThat(afterProgress.myProgress()).isEqualTo(3);
        assertThat(afterProgress.progressPercent()).isEqualTo(60); // 3/5
        assertThat(afterProgress.participantCount()).isEqualTo(2);

        // Creator's own view should still show their own (zero) progress, not the other participant's.
        List<ChallengeResponse> creatorsView = challengeService.listMine("challenge-test-user-3a");
        ChallengeResponse fromCreator = creatorsView.stream().filter(c -> c.id().equals(challengeId)).findFirst().orElseThrow();
        assertThat(fromCreator.myProgress()).isEqualTo(0);
    }

    @Test
    void adjustProgress_rejectsNonParticipant() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-4a", new CreateChallengeRequest(
                "Solo Challenge", null, 5, "2026-01-01", "2026-01-07"));
        challengeId = created.id();

        assertThatThrownBy(() -> challengeService.adjustProgress(
                "challenge-test-user-4b", challengeId, new ChallengeProgressRequest(1)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void join_rejectsDuplicateJoin() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-5a", new CreateChallengeRequest(
                "Challenge", null, 5, "2026-01-01", "2026-01-07"));
        challengeId = created.id();

        assertThatThrownBy(() -> challengeService.join("challenge-test-user-5a", challengeId))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void browse_includesUnjoinedNotYetEndedChallenges() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-6a", new CreateChallengeRequest(
                "Open Challenge", null, 5, LocalDate.now().toString(), LocalDate.now().plusDays(7).toString()));
        challengeId = created.id();

        List<ChallengeResponse> browsed = challengeService.browse("challenge-test-user-6b");
        ChallengeResponse found = browsed.stream().filter(c -> c.id().equals(challengeId)).findFirst().orElseThrow();
        assertThat(found.joined()).isFalse();
    }
}
