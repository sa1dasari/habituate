package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.groups.StreakFreeze;
import com.habituate.api.groups.StreakFreezeRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** HabitService.topOutHabit / getShieldedDates — ownership, the daily-cadence-only
 * guard, and the age-threshold gate (measured from the current segment's own start). */
@SpringBootTest
class HabitServiceTopOutTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private HabitTowerRepository habitTowerRepository;

    @Autowired
    private CheckInRepository checkInRepository;

    @Autowired
    private StreakFreezeRepository streakFreezeRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private String userId;
    private Long habitId;

    @AfterEach
    void cleanup() {
        if (habitId != null) {
            habitService.deleteHabit(userId, habitId);
        }
    }

    private Long createDailyHabit(String uid, Integer topOutThresholdDays) {
        userId = uid;
        HabitResponse response = habitService.createHabit(userId, new CreateHabitRequest(
                "Topout Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null));
        habitId = response.id();
        if (topOutThresholdDays != null) {
            habitService.updateHabit(userId, habitId, new UpdateHabitRequest(
                    null, null, null, null, null, null, null, null, null, null, null, null, topOutThresholdDays));
        }
        return habitId;
    }

    /** Backdates the habit's own createdAt (and its lazily-backfilled open
     * segment, once one exists) so an age-threshold check has something to
     * actually measure against — a habit created this instant is always
     * too young in these tests otherwise. Uses an explicit TransactionTemplate
     * rather than a plain @Transactional test method, since this test class
     * instance isn't itself a Spring-proxied bean — a self-invoked
     * @Transactional method here would silently run with no transaction at
     * all (same self-invocation gotcha HabitService.createCheckIn's own
     * comment documents for production code). */
    void backdateHabitCreation(Long id, int daysAgo) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            entityManager.createNativeQuery("UPDATE habits SET created_at = ?1 WHERE id = ?2")
                    .setParameter(1, Instant.now().minus(daysAgo, ChronoUnit.DAYS))
                    .setParameter(2, id)
                    .executeUpdate();
        });
        entityManager.clear();
    }

    /** Same idea as backdateHabitCreation, but for the currently-open
     * segment's own started_at (habit_towers, not habits) — needed when a
     * test tops out more than once in a row, since each new segment must
     * independently clear the age threshold before it can be topped out
     * again. */
    void backdateCurrentSegment(Long habitId, int daysAgo) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            entityManager.createNativeQuery(
                            "UPDATE habit_towers SET started_at = ?1 WHERE habit_id = ?2 AND topped_out_at IS NULL")
                    .setParameter(1, Instant.now().minus(daysAgo, ChronoUnit.DAYS))
                    .setParameter(2, habitId)
                    .executeUpdate();
        });
        entityManager.clear();
    }

    @Test
    void topOutHabit_rejectsLegacyWeeklyMonthlyShapedHabits() {
        userId = "topout-test-user-1";
        HabitResponse weekly = habitService.createHabit(userId, new CreateHabitRequest(
                "Weekly Habit", "General", "WEEKLY", 1, 3, null, "BOOLEAN", null, null, null, null));
        habitId = weekly.id();

        assertThatThrownBy(() -> habitService.topOutHabit(userId, habitId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("daily");
    }

    @Test
    void topOutHabit_rejectsAPeriodOnlyHabitEvenThoughCadenceTypeSaysDaily() {
        // The real creation form (HabitsScreen.js's deriveCadenceType) always
        // sends cadenceType=DAILY, even for a period-only habit — this is the
        // shape a weekly/monthly "lot" habit actually has today, not the
        // legacy WEEKLY/MONTHLY cadenceType case above.
        userId = "topout-test-user-1b";
        HabitResponse periodOnly = habitService.createHabit(userId, new CreateHabitRequest(
                "Gym", "General", "DAILY", 1, 3, null, "BOOLEAN", null, null, null, null));
        habitId = periodOnly.id();

        assertThatThrownBy(() -> habitService.topOutHabit(userId, habitId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("daily");
    }

    @Test
    void topOutHabit_rejectsATowerYoungerThanItsThreshold() {
        createDailyHabit("topout-test-user-2", 30);
        backdateHabitCreation(habitId, 10); // younger than the 30-day default threshold

        assertThatThrownBy(() -> habitService.topOutHabit(userId, habitId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("30");
    }

    @Test
    void topOutHabit_succeedsOnceTheTowerMeetsItsOwnThreshold() {
        createDailyHabit("topout-test-user-3", 10); // per-habit threshold, lower than the 30-day default
        backdateHabitCreation(habitId, 15);

        habitService.topOutHabit(userId, habitId, "UTC");

        var segments = habitTowerRepository.findByHabitIdOrderByStartedAtAsc(habitId);
        assertThat(segments).hasSize(2);
        assertThat(segments.get(0).getToppedOutAt()).isNotNull();
    }

    @Test
    void topOutHabit_aSecondAttemptRightAfterIsRejected_newSegmentIsTooYoung() {
        createDailyHabit("topout-test-user-4", 10);
        backdateHabitCreation(habitId, 15);
        habitService.topOutHabit(userId, habitId, "UTC");

        assertThatThrownBy(() -> habitService.topOutHabit(userId, habitId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void topOutHabit_rejectsAnotherUsersHabit() {
        createDailyHabit("topout-test-user-5", 10);
        backdateHabitCreation(habitId, 15);

        assertThatThrownBy(() -> habitService.topOutHabit("someone-else", habitId, "UTC"))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void topOutHabit_rejectsAMissingHabit() {
        userId = "topout-test-user-6";
        assertThatThrownBy(() -> habitService.topOutHabit(userId, -1L, "UTC"))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void getShieldedDates_returnsOnlyThisHabitsShieldedDatesSortedAscending() {
        createDailyHabit("topout-test-user-7", null);
        LocalDate d1 = LocalDate.now().minusDays(5);
        LocalDate d2 = LocalDate.now().minusDays(2);
        streakFreezeRepository.save(new StreakFreeze(userId, habitId, d2, StreakFreeze.PERSONAL_GRACE));
        streakFreezeRepository.save(new StreakFreeze(userId, habitId, d1, StreakFreeze.PERSONAL_REPAIR));

        var dates = habitService.getShieldedDates(userId, habitId);

        assertThat(dates).containsExactly(d1, d2);
    }

    @Test
    void getShieldedDates_rejectsAnotherUsersHabit() {
        createDailyHabit("topout-test-user-8", null);

        assertThatThrownBy(() -> habitService.getShieldedDates("someone-else", habitId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void listHabits_aFreshHabitHasNoClosedSegments() {
        createDailyHabit("topout-test-user-9", null);

        var response = habitService.listHabits(userId, "UTC").get(0);

        assertThat(response.closedSegmentCount()).isZero();
        assertThat(response.recentClosedSegments()).isEmpty();
    }

    @Test
    void listHabits_aToppedOutHabitCarriesItsClosedSegmentWithAFloorCount() {
        createDailyHabit("topout-test-user-10", 10);
        backdateHabitCreation(habitId, 15);
        checkInRepository.save(new CheckIn(habitId, userId, Instant.now().minus(1, ChronoUnit.DAYS), 1, "manual"));
        habitService.topOutHabit(userId, habitId, "UTC");
        checkInRepository.save(new CheckIn(habitId, userId, Instant.now(), 1, "manual")); // lands in the new open segment

        var response = habitService.listHabits(userId, "UTC").get(0);

        assertThat(response.closedSegmentCount()).isEqualTo(1);
        assertThat(response.recentClosedSegments()).hasSize(1);
        assertThat(response.recentClosedSegments().get(0).toppedOutAt()).isNotNull();
        assertThat(response.recentClosedSegments().get(0).floorCount()).isEqualTo(1);
    }

    @Test
    void listHabits_onlyTheTwoMostRecentClosedSegmentsAreCarried() {
        createDailyHabit("topout-test-user-11", 1);
        backdateHabitCreation(habitId, 20);
        habitService.topOutHabit(userId, habitId, "UTC");
        backdateCurrentSegment(habitId, 2);
        habitService.topOutHabit(userId, habitId, "UTC");
        backdateCurrentSegment(habitId, 2);
        habitService.topOutHabit(userId, habitId, "UTC");

        var response = habitService.listHabits(userId, "UTC").get(0);

        assertThat(response.closedSegmentCount()).isEqualTo(3);
        assertThat(response.recentClosedSegments()).hasSize(2);
    }
}
