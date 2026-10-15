package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.events.CheckInEventPublisher;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Manual shield activation (HabitService.activateShield/deactivateShield) — the proactive counterpart to PersonalStreakFreezeScheduler's automatic version. */
@SpringBootTest
class HabitServiceManualShieldTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private ShieldAwardRepository shieldAwardRepository;

    @Autowired
    private CheckInRepository checkInRepository;

    @MockBean
    private CheckInEventPublisher checkInEventPublisher;

    private String userId;
    private Long habitId;

    @AfterEach
    void cleanup() {
        if (habitId != null) {
            habitService.deleteHabit(userId, habitId);
        }
    }

    /**
     * Inserts a check-in directly for each of the last `days` days (today
     * inclusive), building a real streak — bypasses HabitService.createCheckIn's
     * "not before the habit was created" guard, which a freshly-created test
     * habit would otherwise always trip for any day but today.
     */
    private HabitResponse createHabitWithStreak(String uid, int days) {
        userId = uid;
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Test Habit", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null));
        habitId = habit.id();
        for (int i = 0; i < days; i++) {
            checkInRepository.save(new CheckIn(habitId, userId, Instant.now().minus(i, ChronoUnit.DAYS), 1, "manual"));
        }
        return habitService.listHabits(userId, "UTC").get(0);
    }

    @Test
    void activateShield_rejectsStreakUnderSeven() {
        createHabitWithStreak("manual-shield-test-user-1", 3);
        shieldAwardRepository.save(new ShieldAward(userId, habitId, 7));

        assertThatThrownBy(() -> habitService.activateShield(userId, habitId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void activateShield_rejectsWhenNoShieldBanked() {
        // 8, not 7 — a streak that's itself a multiple of 7 would auto-earn a
        // shield the moment createHabitWithStreak's own listHabits() call
        // reads it (toResponse awards on every read), defeating "no shield
        // banked". 8 still satisfies the "7+" manual-activation rule without
        // tripping that auto-grant.
        createHabitWithStreak("manual-shield-test-user-2", 8);
        // no ShieldAward granted

        assertThatThrownBy(() -> habitService.activateShield(userId, habitId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void activateShield_succeedsWithSevenDayStreakAndBankedShield() {
        createHabitWithStreak("manual-shield-test-user-3", 8); // see note above
        shieldAwardRepository.save(new ShieldAward(userId, habitId, 7));

        HabitResponse result = habitService.activateShield(userId, habitId, "UTC");

        assertThat(result.shieldedToday()).isTrue();
        assertThat(habitService.getShieldsAvailable(userId)).isEqualTo(0); // spent
    }

    @Test
    void activateShield_rejectsDoubleActivation() {
        createHabitWithStreak("manual-shield-test-user-4", 7);
        shieldAwardRepository.save(new ShieldAward(userId, habitId, 7));
        shieldAwardRepository.save(new ShieldAward(userId, habitId, 14));

        habitService.activateShield(userId, habitId, "UTC");

        assertThatThrownBy(() -> habitService.activateShield(userId, habitId, "UTC"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void deactivateShield_refundsTheShield() {
        createHabitWithStreak("manual-shield-test-user-5", 8); // see note on the "no shield banked" test above
        shieldAwardRepository.save(new ShieldAward(userId, habitId, 7));
        habitService.activateShield(userId, habitId, "UTC");
        assertThat(habitService.getShieldsAvailable(userId)).isEqualTo(0);

        HabitResponse result = habitService.deactivateShield(userId, habitId, "UTC");

        assertThat(result.shieldedToday()).isFalse();
        assertThat(habitService.getShieldsAvailable(userId)).isEqualTo(1); // refunded
    }

    @Test
    void shieldEligible_reflectsTheSevenDayThreshold() {
        HabitResponse underSeven = createHabitWithStreak("manual-shield-test-user-6", 5);
        assertThat(underSeven.shieldEligible()).isFalse();
    }
}
