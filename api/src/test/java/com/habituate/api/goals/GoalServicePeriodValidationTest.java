package com.habituate.api.goals;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * createGoal used to silently coerce any period typo ("Montly") to WEEKLY
 * instead of rejecting it, so a client mistake looked like success but the
 * goal was tracked on the wrong cadence with no indication anything was wrong.
 */
@SpringBootTest
class GoalServicePeriodValidationTest {

    @Autowired
    private GoalService goalService;

    private String userId;
    private Long goalId;

    @AfterEach
    void cleanup() {
        if (goalId != null) {
            goalService.deleteGoal(userId, goalId);
        }
    }

    @Test
    void createGoal_rejectsInvalidPeriod() {
        userId = "goal-period-test-user";
        assertThatThrownBy(() ->
                goalService.createGoal(userId, new CreateGoalRequest("Test goal", "Montly", 5, "2026-01-01"))
        ).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createGoal_defaultsToWeekly_whenPeriodOmitted() {
        userId = "goal-period-test-user";
        GoalResponse response = goalService.createGoal(
                userId, new CreateGoalRequest("Test goal", null, 5, "2026-01-01"));
        goalId = response.id();
        assertThat(response.period()).isEqualTo("WEEKLY");
    }

    @Test
    void createGoal_acceptsMonthly() {
        userId = "goal-period-test-user";
        GoalResponse response = goalService.createGoal(
                userId, new CreateGoalRequest("Test goal", "monthly", 5, "2026-01-01"));
        goalId = response.id();
        assertThat(response.period()).isEqualTo("MONTHLY");
    }
}
