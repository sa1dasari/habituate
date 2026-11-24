package com.habituate.api.habits;

import com.habituate.api.billing.EntitlementService;
import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Free-tier habit-count caps (SKYLINE.md section 14 #21) — HabitService's
 * own server-side backstop behind the mobile client's pre-check. See
 * ShieldAwardServiceTest for the Shield Day cap's equivalent coverage.
 */
@SpringBootTest
class HabitServiceCapTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private UserRepository userRepository;

    private String userId;

    @AfterEach
    void cleanup() {
        if (userId != null) {
            habitRepository.findByUserIdOrderByCreatedAtDesc(userId)
                    .forEach(h -> habitRepository.deleteById(h.getId()));
            userRepository.findById(userId).ifPresent(u -> userRepository.deleteById(userId));
        }
    }

    private CreateHabitRequest dailyRequest(String name) {
        return new CreateHabitRequest(name, "General", "DAILY", 1, null, null, "BOOLEAN", false, "", false, "");
    }

    private CreateHabitRequest weeklyRequest(String name) {
        return new CreateHabitRequest(name, "General", "DAILY", 1, 3, null, "BOOLEAN", false, "", false, "");
    }

    private CreateHabitRequest monthlyRequest(String name) {
        return new CreateHabitRequest(name, "General", "DAILY", 1, null, 10, "BOOLEAN", false, "", false, "");
    }

    @Test
    void createHabit_allowsUpToTheFreeTierDailyLimitThenBlocks() {
        userId = "habit-cap-test-user-1";
        for (int i = 0; i < EntitlementService.FREE_DAILY_HABIT_LIMIT; i++) {
            habitService.createHabit(userId, dailyRequest("Daily " + i));
        }
        assertThatThrownBy(() -> habitService.createHabit(userId, dailyRequest("One too many")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("free plan holds");
    }

    @Test
    void createHabit_weeklyAndMonthlyCapsAreIndependentOfDaily() {
        userId = "habit-cap-test-user-2";
        habitService.createHabit(userId, dailyRequest("Daily 0")); // doesn't count against weekly/monthly
        habitService.createHabit(userId, weeklyRequest("Weekly 0"));
        habitService.createHabit(userId, monthlyRequest("Monthly 0"));

        assertThatThrownBy(() -> habitService.createHabit(userId, weeklyRequest("Weekly 1")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("weekly habit");
        assertThatThrownBy(() -> habitService.createHabit(userId, monthlyRequest("Monthly 1")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("monthly habit");
    }

    @Test
    void createHabit_lifetimeUnlockedUserIsNeverCapped() {
        userId = "habit-cap-test-user-3";
        User user = new User(userId, null);
        user.setLifetimePurchased(true);
        userRepository.save(user);

        for (int i = 0; i < EntitlementService.FREE_DAILY_HABIT_LIMIT + 1; i++) {
            habitService.createHabit(userId, dailyRequest("Daily " + i));
        }
        assertThat(habitRepository.findByUserIdOrderByCreatedAtDesc(userId))
                .hasSize(EntitlementService.FREE_DAILY_HABIT_LIMIT + 1);
    }
}
