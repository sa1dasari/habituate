package com.habituate.api.habits;

import com.habituate.api.events.CheckInEventPublisher;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Default effortLevel inference drives the "morphing" home-card treatment — see HabitService.inferEffortLevel. */
@SpringBootTest
class HabitServiceEffortLevelTest {

    @Autowired
    private HabitService habitService;

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

    @Test
    void create_withNoPeriodTarget_defaultsToQuick() {
        userId = "effort-test-user-1";
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Vitamins", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null));
        habitId = habit.id();

        assertThat(habit.effortLevel()).isEqualTo(Habit.QUICK);
    }

    @Test
    void create_withHighCountTarget_defaultsToIntense() {
        userId = "effort-test-user-2";
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Job applications", "General", "DAILY", 1, null, 50, "COUNT", null, null, null, null));
        habitId = habit.id();

        assertThat(habit.effortLevel()).isEqualTo(Habit.INTENSE);
    }

    @Test
    void create_withWeeklyAndMonthlyTarget_defaultsToIntense() {
        userId = "effort-test-user-3";
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Gym", "Fitness", "DAILY", 1, 3, 10, "BOOLEAN", null, null, null, null));
        habitId = habit.id();

        assertThat(habit.effortLevel()).isEqualTo(Habit.INTENSE);
    }

    @Test
    void create_withOnlyWeeklyTarget_defaultsToModerate() {
        userId = "effort-test-user-4";
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Read", "Learning", "DAILY", 1, 3, null, "BOOLEAN", null, null, null, null));
        habitId = habit.id();

        assertThat(habit.effortLevel()).isEqualTo(Habit.MODERATE);
    }

    @Test
    void create_withExplicitEffortLevel_overridesInference() {
        userId = "effort-test-user-5";
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Vitamins", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, "intense"));
        habitId = habit.id();

        assertThat(habit.effortLevel()).isEqualTo(Habit.INTENSE);
    }

    @Test
    void create_rejectsInvalidEffortLevel() {
        userId = "effort-test-user-6";
        assertThatThrownBy(() -> habitService.createHabit(userId, new CreateHabitRequest(
                "Vitamins", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, "SUPER_HARD")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateHabit_canCorrectEffortLevel() {
        userId = "effort-test-user-7";
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Vitamins", "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null));
        habitId = habit.id();
        assertThat(habit.effortLevel()).isEqualTo(Habit.QUICK);

        HabitResponse updated = habitService.updateHabit(userId, habitId, new UpdateHabitRequest(
                null, null, null, null, null, null, null, null, null, null, null, "intense"));
        assertThat(updated.effortLevel()).isEqualTo(Habit.INTENSE);
    }
}
