package com.habituate.api.habits;

import java.time.Instant;
import java.time.format.DateTimeFormatter;

public record HabitResponse(
        Long id,
        String userId,
        String name,
        String category,
        String cadenceType,
        Integer cadenceTarget,
        String scheduledTime,
        boolean reminderEnabled,
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
                habit.getScheduledTime() == null
                        ? null
                        : habit.getScheduledTime().format(DateTimeFormatter.ofPattern("HH:mm")),
                habit.isReminderEnabled(),
                habit.isArchived(),
                habit.getCreatedAt(),
                habit.getUpdatedAt()
        );
    }
}
