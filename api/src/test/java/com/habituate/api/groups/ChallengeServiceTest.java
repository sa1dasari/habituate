package com.habituate.api.groups;

import com.habituate.api.common.DuplicateCheckInException;
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

    @Autowired
    private ChallengeCheckInRepository checkInRepository;

    @MockBean
    private UserLookupService userLookupService;

    private Long challengeId;

    @AfterEach
    void cleanup() {
        if (challengeId != null) {
            checkInRepository.findAll().stream()
                    .filter(c -> c.getChallengeId().equals(challengeId))
                    .forEach(c -> checkInRepository.deleteById(c.getId()));
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
                "Morning Routine", "Do it every day", 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = response.id();

        assertThat(response.joined()).isTrue();
        assertThat(response.myProgress()).isEqualTo(0);
        assertThat(response.progressPercent()).isEqualTo(0);
        assertThat(response.participantCount()).isEqualTo(1);
        assertThat(response.checkedInToday()).isFalse();
        assertThat(response.visibility()).isEqualTo("PRIVATE");
    }

    @Test
    void create_rejectsEndBeforeStart() {
        assertThatThrownBy(() -> challengeService.create("challenge-test-user-2", new CreateChallengeRequest(
                "Bad Dates", null, 5, "2026-01-07", "2026-01-01", null), "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void create_rejectsRangeOverOneYear() {
        assertThatThrownBy(() -> challengeService.create("challenge-test-user-2b", new CreateChallengeRequest(
                "Too Long", null, 5, "2026-01-01", "2027-06-01", "PUBLIC"), "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void create_publicVisibility_appearsInBrowse() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-2c", new CreateChallengeRequest(
                "Public Challenge", null, 5, LocalDate.now().toString(), LocalDate.now().plusDays(7).toString(), "public"),
                "UTC");
        challengeId = created.id();

        List<ChallengeResponse> browsed = challengeService.browse("challenge-test-user-2d", "UTC");
        assertThat(browsed).anyMatch(c -> c.id().equals(challengeId));
    }

    @Test
    void create_privateVisibility_hiddenFromBrowse() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-2e", new CreateChallengeRequest(
                "Private Challenge", null, 5, LocalDate.now().toString(), LocalDate.now().plusDays(7).toString(), null),
                "UTC");
        challengeId = created.id();

        List<ChallengeResponse> browsed = challengeService.browse("challenge-test-user-2f", "UTC");
        assertThat(browsed).noneMatch(c -> c.id().equals(challengeId));
    }

    @Test
    void logCheckIn_thenUnlog_updatesMyProgressOnly() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-3a", new CreateChallengeRequest(
                "Shared Goal", null, 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        challengeService.join("challenge-test-user-3b", challengeId, "UTC");
        ChallengeResponse afterLog = challengeService.logCheckIn("challenge-test-user-3b", challengeId, "UTC");

        assertThat(afterLog.myProgress()).isEqualTo(1);
        assertThat(afterLog.checkedInToday()).isTrue();
        assertThat(afterLog.progressPercent()).isEqualTo(20); // 1/5
        assertThat(afterLog.participantCount()).isEqualTo(2);

        // Creator's own view should still show their own (zero) progress, not the other participant's.
        List<ChallengeResponse> creatorsView = challengeService.listMine("challenge-test-user-3a", "UTC");
        ChallengeResponse fromCreator = creatorsView.stream().filter(c -> c.id().equals(challengeId)).findFirst().orElseThrow();
        assertThat(fromCreator.myProgress()).isEqualTo(0);

        ChallengeResponse afterUnlog = challengeService.unlogCheckIn("challenge-test-user-3b", challengeId, "UTC");
        assertThat(afterUnlog.myProgress()).isEqualTo(0);
        assertThat(afterUnlog.checkedInToday()).isFalse();
    }

    @Test
    void logCheckIn_rejectsDuplicateSameDay() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-3c", new CreateChallengeRequest(
                "Once A Day", null, 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        challengeService.logCheckIn("challenge-test-user-3c", challengeId, "UTC");

        assertThatThrownBy(() -> challengeService.logCheckIn("challenge-test-user-3c", challengeId, "UTC"))
                .isInstanceOf(DuplicateCheckInException.class);
    }

    @Test
    void unlogCheckIn_withNothingLoggedToday_notFound() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-3d", new CreateChallengeRequest(
                "Nothing Logged", null, 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        assertThatThrownBy(() -> challengeService.unlogCheckIn("challenge-test-user-3d", challengeId, "UTC"))
                .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
    }

    @Test
    void logCheckIn_rejectsNonParticipant() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-4a", new CreateChallengeRequest(
                "Solo Challenge", null, 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        assertThatThrownBy(() -> challengeService.logCheckIn("challenge-test-user-4b", challengeId, "UTC"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void join_rejectsDuplicateJoin() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-5a", new CreateChallengeRequest(
                "Challenge", null, 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        assertThatThrownBy(() -> challengeService.join("challenge-test-user-5a", challengeId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void browse_includesUnjoinedPublicChallenges() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-6a", new CreateChallengeRequest(
                "Open Challenge", null, 5, LocalDate.now().toString(), LocalDate.now().plusDays(7).toString(), "PUBLIC"),
                "UTC");
        challengeId = created.id();

        List<ChallengeResponse> browsed = challengeService.browse("challenge-test-user-6b", "UTC");
        ChallengeResponse found = browsed.stream().filter(c -> c.id().equals(challengeId)).findFirst().orElseThrow();
        assertThat(found.joined()).isFalse();
    }
}
