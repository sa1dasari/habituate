package com.habituate.api.habits;

import java.time.Instant;

public record HabitResponse(
        Long id,
        String userId,
        String name,
        String category,
        String cadenceType,
        Integer cadenceTarget,
        boolean archived,
        Instant createdAt,
        Instant updatedAt
) {
    public static HabitResponse from(Habit habit) {
        return new HabitResponse(
                habit.getId(),
                habit.getUserId(),
                habit.getName(),
                habit.getCategory(),
                habit.getCadenceType(),
                habit.getCadenceTarget(),
                habit.isArchived(),
                habit.getCreatedAt(),
                habit.getUpdatedAt()
        );
    }
}
