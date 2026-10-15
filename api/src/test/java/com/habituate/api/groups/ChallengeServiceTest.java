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

    @MockBean
    private FriendshipService friendshipService;

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

    private CreateChallengeRequest basicRequest(String name, Integer targetCount, String periodStart, String periodEnd, String visibility) {
        return new CreateChallengeRequest(
                name, "Do it every day", targetCount, periodStart, periodEnd, visibility,
                null, null, null, null, null, null, null);
    }

    @Test
    void create_autoJoinsCreatorWithZeroProgress() {
        stubResolve();
        ChallengeResponse response = challengeService.create("challenge-test-user-1",
                basicRequest("Morning Routine", 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = response.id();

        assertThat(response.joined()).isTrue();
        assertThat(response.myProgress()).isEqualTo(0);
        assertThat(response.progressPercent()).isEqualTo(0);
        assertThat(response.participantCount()).isEqualTo(1);
        assertThat(response.checkedInToday()).isFalse();
        assertThat(response.visibility()).isEqualTo("PRIVATE");
        assertThat(response.trackingMode()).isEqualTo("BOOLEAN");
        assertThat(response.cadenceType()).isEqualTo("DAILY");
    }

    @Test
    void create_openEnded_whenPeriodEndOmitted() {
        stubResolve();
        ChallengeResponse response = challengeService.create("challenge-test-user-1b",
                basicRequest("Open Ended", 5, "2026-01-01", null, null), "UTC");
        challengeId = response.id();

        assertThat(response.periodEnd()).isNull();
    }

    @Test
    void create_rejectsEndBeforeStart() {
        assertThatThrownBy(() -> challengeService.create("challenge-test-user-2",
                basicRequest("Bad Dates", 5, "2026-01-07", "2026-01-01", null), "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void create_rejectsRangeOverOneYear() {
        assertThatThrownBy(() -> challengeService.create("challenge-test-user-2b",
                basicRequest("Too Long", 5, "2026-01-01", "2027-06-01", "PUBLIC"), "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void create_publicVisibility_appearsInBrowse() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-2c", basicRequest(
                "Public Challenge", 5, LocalDate.now().toString(), LocalDate.now().plusDays(7).toString(), "public"),
                "UTC");
        challengeId = created.id();

        List<ChallengeResponse> browsed = challengeService.browse("challenge-test-user-2d", "UTC");
        assertThat(browsed).anyMatch(c -> c.id().equals(challengeId));
    }

    @Test
    void create_privateVisibility_hiddenFromBrowse() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-2e", basicRequest(
                "Private Challenge", 5, LocalDate.now().toString(), LocalDate.now().plusDays(7).toString(), null),
                "UTC");
        challengeId = created.id();

        List<ChallengeResponse> browsed = challengeService.browse("challenge-test-user-2f", "UTC");
        assertThat(browsed).noneMatch(c -> c.id().equals(challengeId));
    }

    @Test
    void create_openEnded_appearsInBrowse() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-2g",
                basicRequest("Open Ended Public", 5, LocalDate.now().toString(), null, "PUBLIC"), "UTC");
        challengeId = created.id();

        List<ChallengeResponse> browsed = challengeService.browse("challenge-test-user-2h", "UTC");
        assertThat(browsed).anyMatch(c -> c.id().equals(challengeId));
    }

    @Test
    void logCheckIn_thenUnlog_updatesMyProgressOnly() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-3a",
                basicRequest("Shared Goal", 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        challengeService.join("challenge-test-user-3b", challengeId, "UTC");
        ChallengeResponse afterLog = challengeService.logCheckIn("challenge-test-user-3b", challengeId, null, "UTC");

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
        ChallengeResponse created = challengeService.create("challenge-test-user-3c",
                basicRequest("Once A Day", 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        challengeService.logCheckIn("challenge-test-user-3c", challengeId, null, "UTC");

        assertThatThrownBy(() -> challengeService.logCheckIn("challenge-test-user-3c", challengeId, null, "UTC"))
                .isInstanceOf(DuplicateCheckInException.class);
    }

    @Test
    void unlogCheckIn_withNothingLoggedToday_notFound() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-3d",
                basicRequest("Nothing Logged", 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        assertThatThrownBy(() -> challengeService.unlogCheckIn("challenge-test-user-3d", challengeId, "UTC"))
                .isInstanceOf(jakarta.persistence.EntityNotFoundException.class);
    }

    @Test
    void logCheckIn_rejectsNonParticipant() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-4a",
                basicRequest("Solo Challenge", 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        assertThatThrownBy(() -> challengeService.logCheckIn("challenge-test-user-4b", challengeId, null, "UTC"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void join_rejectsDuplicateJoin() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-5a",
                basicRequest("Challenge", 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        assertThatThrownBy(() -> challengeService.join("challenge-test-user-5a", challengeId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void browse_includesUnjoinedPublicChallenges() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-6a", basicRequest(
                "Open Challenge", 5, LocalDate.now().toString(), LocalDate.now().plusDays(7).toString(), "PUBLIC"),
                "UTC");
        challengeId = created.id();

        List<ChallengeResponse> browsed = challengeService.browse("challenge-test-user-6b", "UTC");
        ChallengeResponse found = browsed.stream().filter(c -> c.id().equals(challengeId)).findFirst().orElseThrow();
        assertThat(found.joined()).isFalse();
    }

    @Test
    void create_countTrackingMode_sumsLoggedValues() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-8a", new CreateChallengeRequest(
                "Water Goal", "Drink up", 80, "2026-01-01", "2026-01-07", null,
                null, null, "COUNT", null, null, null, null), "UTC");
        challengeId = created.id();
        assertThat(created.trackingMode()).isEqualTo("COUNT");

        challengeService.logCheckIn("challenge-test-user-8a", challengeId, 20, "UTC");
        ChallengeResponse afterSecondLog = challengeService.logCheckIn("challenge-test-user-8a", challengeId, 30, "UTC");

        assertThat(afterSecondLog.myProgress()).isEqualTo(50);
        assertThat(afterSecondLog.progressPercent()).isEqualTo(63); // round(50/80*100)

        ChallengeResponse afterUndo = challengeService.unlogCheckIn("challenge-test-user-8a", challengeId, "UTC");
        assertThat(afterUndo.myProgress()).isEqualTo(20);
    }

    @Test
    void create_weeklyQuotaCadence_requiresWeeklyQuota() {
        assertThatThrownBy(() -> challengeService.create("challenge-test-user-9a", new CreateChallengeRequest(
                "Gym", null, 12, "2026-01-01", "2026-01-31", null,
                null, null, null, "WEEKLY_QUOTA", null, null, null), "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void create_customDaysCadence_storesDays() {
        stubResolve();
        ChallengeResponse created = challengeService.create("challenge-test-user-9b", new CreateChallengeRequest(
                "Mon Wed Fri", null, 12, "2026-01-01", "2026-01-31", null,
                null, null, null, "CUSTOM_DAYS", null, "1,3,5", null), "UTC");
        challengeId = created.id();

        assertThat(created.cadenceType()).isEqualTo("CUSTOM_DAYS");
        assertThat(created.customDays()).isEqualTo("1,3,5");
    }

    @Test
    void invite_addsFriendAsParticipant() {
        stubResolve();
        when(friendshipService.areFriends("challenge-test-user-10a", "challenge-test-user-10b")).thenReturn(true);
        ChallengeResponse created = challengeService.create("challenge-test-user-10a",
                basicRequest("Invite Test", 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        challengeService.invite("challenge-test-user-10a", challengeId, "challenge-test-user-10b", "UTC");

        List<ChallengeResponse> theirView = challengeService.listMine("challenge-test-user-10b", "UTC");
        assertThat(theirView).anyMatch(c -> c.id().equals(challengeId));
    }

    @Test
    void invite_rejectsNonFriend() {
        stubResolve();
        when(friendshipService.areFriends("challenge-test-user-11a", "challenge-test-user-11b")).thenReturn(false);
        ChallengeResponse created = challengeService.create("challenge-test-user-11a",
                basicRequest("Invite Test 2", 5, "2026-01-01", "2026-01-07", null), "UTC");
        challengeId = created.id();

        assertThatThrownBy(() -> challengeService.invite("challenge-test-user-11a", challengeId, "challenge-test-user-11b", "UTC"))
                .isInstanceOf(ForbiddenException.class);
    }
}
