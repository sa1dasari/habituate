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
    void topOutHabit_isAllowedOnAnyDay_evenForABrandNewTower() {
        createDailyHabit("topout-test-user-2", 30); // far younger than its 30-day cap

        habitService.topOutHabit(userId, habitId, "UTC");

        var segments = habitTowerRepository.findByHabitIdOrderByStartedAtAsc(habitId);
        assertThat(segments).hasSize(2);
        assertThat(segments.get(0).getToppedOutAt()).isNotNull();
        assertThat(segments.get(0).isAutoToppedOut()).isFalse();
    }

    @Test
    void topOutHabit_closesTheOpenSegmentAndOpensANewOne() {
        createDailyHabit("topout-test-user-3", 10);
        backdateHabitCreation(habitId, 15);

        habitService.topOutHabit(userId, habitId, "UTC");

        var segments = habitTowerRepository.findByHabitIdOrderByStartedAtAsc(habitId);
        assertThat(segments).hasSize(2);
        assertThat(segments.get(0).getToppedOutAt()).isNotNull();
        assertThat(segments.get(1).getToppedOutAt()).isNull();
    }

    @Test
    void topOutHabit_aSecondManualTopOutRightAfterIsAlsoAllowed() {
        createDailyHabit("topout-test-user-4", 10);
        habitService.topOutHabit(userId, habitId, "UTC");

        habitService.topOutHabit(userId, habitId, "UTC");

        assertThat(habitTowerRepository.findByHabitIdOrderByStartedAtAsc(habitId)).hasSize(3);
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

    // ---- the cap: validation

    @Test
    void createHabit_defaultsTheCapToThirtyAndAcceptsOneOfTheirOwn() {
        userId = "topout-test-user-12";
        HabitResponse defaulted = habitService.createHabit(userId, new CreateHabitRequest(
                "Default Cap", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null));
        assertThat(defaulted.topOutThresholdDays()).isEqualTo(30);
        habitService.deleteHabit(userId, defaulted.id());

        HabitResponse custom = habitService.createHabit(userId, new CreateHabitRequest(
                "Custom Cap", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null, 21));
        habitId = custom.id();

        assertThat(custom.topOutThresholdDays()).isEqualTo(21);
    }

    @Test
    void createHabit_rejectsACapAboveThirtyFiveWithASpecificMessage() {
        userId = "topout-test-user-13";

        assertThatThrownBy(() -> habitService.createHabit(userId, new CreateHabitRequest(
                "Too High", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null, 36)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Top out after must be between 1 and 35 days");
    }

    @Test
    void updateHabit_acceptsThirtyFiveButRejectsThirtySixAndZero() {
        createDailyHabit("topout-test-user-14", null);

        habitService.updateHabit(userId, habitId, new UpdateHabitRequest(
                null, null, null, null, null, null, null, null, null, null, null, null, 35));
        assertThat(habitRepository.findById(habitId).orElseThrow().getTopOutThresholdDays()).isEqualTo(35);

        assertThatThrownBy(() -> habitService.updateHabit(userId, habitId, new UpdateHabitRequest(
                null, null, null, null, null, null, null, null, null, null, null, null, 36)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Top out after must be between 1 and 35 days");
        assertThatThrownBy(() -> habitService.updateHabit(userId, habitId, new UpdateHabitRequest(
                null, null, null, null, null, null, null, null, null, null, null, null, 0)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---- automatic top-out

    private Habit loadHabit() {
        return habitRepository.findById(habitId).orElseThrow();
    }

    @Test
    void autoTopOut_closesATowerThatHasStoodItsCap_atTheCapBoundary_andFlagsItAutomatic() {
        createDailyHabit("topout-test-user-15", 30);
        backdateHabitCreation(habitId, 40);

        boolean toppedOut = habitService.autoTopOutIfDue(loadHabit(), java.time.ZoneOffset.UTC, Instant.now());

        assertThat(toppedOut).isTrue();
        var segments = habitTowerRepository.findByHabitIdOrderByStartedAtAsc(habitId);
        assertThat(segments).hasSize(2);
        assertThat(segments.get(0).isAutoToppedOut()).isTrue();
        assertThat(segments.get(0).getToppedOutAt()).isEqualTo(segments.get(1).getStartedAt());
        assertThat(segments.get(1).getToppedOutAt()).isNull();
        assertThat(segments.get(1).isAutoToppedOut()).isFalse();
    }

    @Test
    void autoTopOut_doesNothingBeforeTheCap_andIsIdempotentAfterIt() {
        createDailyHabit("topout-test-user-16", 30);
        backdateHabitCreation(habitId, 10);
        assertThat(habitService.autoTopOutIfDue(loadHabit(), java.time.ZoneOffset.UTC, Instant.now())).isFalse();

        backdateCurrentSegment(habitId, 40);
        assertThat(habitService.autoTopOutIfDue(loadHabit(), java.time.ZoneOffset.UTC, Instant.now())).isTrue();
        assertThat(habitService.autoTopOutIfDue(loadHabit(), java.time.ZoneOffset.UTC, Instant.now())).isFalse();

        assertThat(habitTowerRepository.findByHabitIdOrderByStartedAtAsc(habitId)).hasSize(2);
    }

    @Test
    void autoTopOut_closesOnlyOnceEvenWhenSeveralCapsAreOverdue() {
        createDailyHabit("topout-test-user-17", 10);
        backdateHabitCreation(habitId, 95); // nine and a half caps overdue

        habitService.autoTopOutIfDue(loadHabit(), java.time.ZoneOffset.UTC, Instant.now());

        assertThat(habitTowerRepository.findByHabitIdOrderByStartedAtAsc(habitId)).hasSize(2);
    }

    @Test
    void autoTopOut_neverTouchesWeeklyOrMonthlyHabits() {
        userId = "topout-test-user-18";
        HabitResponse lot = habitService.createHabit(userId, new CreateHabitRequest(
                "Gym", "General", "DAILY", 1, 3, null, "BOOLEAN", null, null, null, null));
        habitId = lot.id();
        backdateHabitCreation(habitId, 90);

        assertThat(habitService.autoTopOutIfDue(loadHabit(), java.time.ZoneOffset.UTC, Instant.now())).isFalse();
        assertThat(habitTowerRepository.findByHabitIdOrderByStartedAtAsc(habitId)).isEmpty();
    }

    @Test
    void autoTopOut_leavesARetiredHabitAlone() {
        createDailyHabit("topout-test-user-19", 10);
        backdateHabitCreation(habitId, 40);
        habitService.updateHabit(userId, habitId, new UpdateHabitRequest(
                null, null, null, null, null, null, null, null, null, null, true, null, null));

        assertThat(habitService.autoTopOutIfDue(loadHabit(), java.time.ZoneOffset.UTC, Instant.now())).isFalse();
    }

    @Test
    void autoTopOut_keepsTheRunAndCheckIns() {
        createDailyHabit("topout-test-user-20", 10);
        backdateHabitCreation(habitId, 30);
        Instant yesterday = Instant.now().minus(1, ChronoUnit.DAYS);
        checkInRepository.save(new CheckIn(habitId, userId, yesterday, 1, "manual"));

        habitService.autoTopOutIfDue(loadHabit(), java.time.ZoneOffset.UTC, Instant.now());

        assertThat(checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtAsc(userId, habitId)).hasSize(1);
    }

    // ---- the one-time clamp

    @Test
    void clampTopOutCaps_bringsCapsAboveThirtyFiveDownToThirtyFive_andIsIdempotent() {
        createDailyHabit("topout-test-user-21", null);
        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                entityManager.createNativeQuery("UPDATE habits SET top_out_threshold_days = 3650 WHERE id = ?1")
                        .setParameter(1, habitId)
                        .executeUpdate());
        entityManager.clear();

        int first = habitService.clampTopOutCaps();
        entityManager.clear();

        assertThat(first).isGreaterThanOrEqualTo(1);
        assertThat(habitRepository.findById(habitId).orElseThrow().getTopOutThresholdDays()).isEqualTo(35);
        assertThat(habitService.clampTopOutCaps()).isZero();
    }
}
