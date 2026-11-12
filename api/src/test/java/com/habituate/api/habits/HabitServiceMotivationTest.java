package com.habituate.api.habits;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

/** The optional "why this matters" field — createHabit/updateHabit, including
 *  the "blank clears it" convention updateHabit already uses for
 *  weeklyTarget/monthlyTarget. */
@SpringBootTest
class HabitServiceMotivationTest {

    @Autowired
    private HabitService habitService;

    private String userId;
    private Long habitId;

    @AfterEach
    void cleanup() {
        if (habitId != null) {
            habitService.deleteHabit(userId, habitId);
        }
    }

    @Test
    void createHabit_savesTheStatedMotivation() {
        userId = "motivation-test-user-1";
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Meditate", "Wellness", "DAILY", 1, null, null, "BOOLEAN", null, null, null,
                "So I'm calmer with my kids"));
        habitId = habit.id();

        assertThat(habit.motivation()).isEqualTo("So I'm calmer with my kids");
    }

    @Test
    void createHabit_leavesMotivationNullWhenNotProvided() {
        userId = "motivation-test-user-2";
        HabitResponse habit = habitService.createHabit(userId, new CreateHabitRequest(
                "Meditate", "Wellness", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null));
        habitId = habit.id();

        assertThat(habit.motivation()).isNull();
    }

    @Test
    void updateHabit_setsMotivationOnAHabitThatHadNone() {
        userId = "motivation-test-user-3";
        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Meditate", "Wellness", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null)).id();

        HabitResponse updated = habitService.updateHabit(userId, habitId, new UpdateHabitRequest(
                null, null, null, null, null, null, null, null, null, null, null, "Calmer with the kids", null));

        assertThat(updated.motivation()).isEqualTo("Calmer with the kids");
    }

    @Test
    void updateHabit_blankMotivationClearsAPreviouslySetOne() {
        userId = "motivation-test-user-4";
        habitId = habitService.createHabit(userId, new CreateHabitRequest(
                "Meditate", "Wellness", "DAILY", 1, null, null, "BOOLEAN", null, null, null,
                "So I'm calmer with my kids")).id();

        HabitResponse updated = habitService.updateHabit(userId, habitId, new UpdateHabitRequest(
                null, null, null, null, null, null, null, null, null, null, null, "   ", null));

        assertThat(updated.motivation()).isNull();
    }
}
