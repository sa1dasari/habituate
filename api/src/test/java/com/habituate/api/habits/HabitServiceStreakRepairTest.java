package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.groups.StreakFreeze;
import com.habituate.api.groups.StreakFreezeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** HabitService.repairStreak — recovering an already-broken streak, distinct from Shield Days
 * (HabitServiceManualShieldTest), which only ever protect a streak before it breaks. */
@SpringBootTest
class HabitServiceStreakRepairTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private CheckInRepository checkInRepository;

    @Autowired
    private StreakFreezeRepository streakFreezeRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String userId;
    private Long habitId;

    @AfterEach
    void cleanup() {
        if (habitId != null) {
            habitService.deleteHabit(userId, habitId);
        }
    }

    /** Checks in for each offset in daysAgo (0 = today), skipping every other day — builds an
     * exact, controlled check-in history rather than a contiguous streak. Backdates the habit's
     * own createdAt 30 days (JPA won't update it via the entity API, updatable = false — same
     * jdbcTemplate bypass HabitServiceCheckInTimezoneTest uses) so repairStreak's "not before the
     * habit existed" guard doesn't reject these artificially-backdated check-ins. */
    private HabitResponse createHabit(String uid, int... checkedInDaysAgo) {
        userId = uid;
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Repair Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null));
        habitId = habit.id();
        jdbcTemplate.update(
                "UPDATE habits SET created_at = ? WHERE id = ?",
                Timestamp.from(Instant.now().minus(30, ChronoUnit.DAYS)), habitId);
        for (int daysAgo : checkedInDaysAgo) {
            checkInRepository.save(new CheckIn(habitId, userId, Instant.now().minus(daysAgo, ChronoUnit.DAYS), 1, "manual"));
        }
        return habitService.listHabits(userId, "UTC").get(0);
    }

    @Test
    void repairStreak_restoresAStreakBrokenYesterday() {
        // Checked in today-5..today-2 (4-day streak), skipped yesterday (today-1), nothing today yet.
        createHabit("repair-test-user-1", 5, 4, 3, 2);

        HabitResponse result = habitService.repairStreak(userId, habitId, "UTC");

        LocalDate yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1);
        assertThat(streakFreezeRepository.findByHabitIdAndUsedOnDate(habitId, yesterday))
                .isPresent()
                .get()
                .extracting(StreakFreeze::getSource)
                .isEqualTo(StreakFreeze.PERSONAL_REPAIR);
        assertThat(result.currentStreak()).isGreaterThan(0);
    }

    @Test
    void repairStreak_rejectsWhenNothingRecentlyBroke() {
        // Unbroken streak through today — nothing to repair.
        createHabit("repair-test-user-2", 3, 2, 1, 0);

        assertThatThrownBy(() -> habitService.repairStreak(userId, habitId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void repairStreak_rejectsWhenBreakIsOlderThanTheWindow() {
        // Streak ran today-6..today-4, broke at today-3 (outside the 2-day window) — today-2/today-1 are
        // also unchecked, but the streak was already 0 before either of them, so neither qualifies.
        createHabit("repair-test-user-3", 6, 5, 4);

        assertThatThrownBy(() -> habitService.repairStreak(userId, habitId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void repairStreak_rejectsASecondRepairInTheSameMonth() {
        createHabit("repair-test-user-4", 5, 4, 3, 2);
        habitService.repairStreak(userId, habitId, "UTC");

        assertThatThrownBy(() -> habitService.repairStreak(userId, habitId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
