package com.habituate.api.goals;

import java.time.Instant;
import java.time.LocalDate;

public record GoalResponse(
        Long id,
        String userId,
        String description,
        String period,
        Integer targetCount,
        Integer currentCount,
        LocalDate periodStart,
        boolean archived,
        Instant createdAt,
        Instant updatedAt
) {
    public static GoalResponse from(Goal goal) {
        return new GoalResponse(
                goal.getId(),
                goal.getUserId(),
                goal.getDescription(),
                goal.getPeriod(),
                goal.getTargetCount(),
                goal.getCurrentCount(),
                goal.getPeriodStart(),
                goal.isArchived(),
                goal.getCreatedAt(),
                goal.getUpdatedAt()
        );
    }
}
