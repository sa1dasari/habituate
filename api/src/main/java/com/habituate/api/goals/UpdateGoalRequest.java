package com.habituate.api.goals;

public record UpdateGoalRequest(
        String description,
        Integer targetCount,
        Boolean archived
) {
}
