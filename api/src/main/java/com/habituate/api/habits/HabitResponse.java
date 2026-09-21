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
        Integer weeklyTarget,
        Integer monthlyTarget,
        String trackingMode,
        boolean featuredGoal,
        String scheduledTime,
        boolean reminderEnabled,
        boolean archived,
        Instant createdAt,
        Instant updatedAt,
        int currentStreak,
        int longestStreak
) {
    public static HabitResponse from(Habit habit, int currentStreak, int longestStreak) {
        return new HabitResponse(
                habit.getId(),
                habit.getUserId(),
                habit.getName(),
                habit.getCategory(),
                habit.getCadenceType(),
                habit.getCadenceTarget(),
                habit.getWeeklyTarget(),
                habit.getMonthlyTarget(),
                habit.getTrackingMode(),
                habit.isFeaturedGoal(),
                habit.getScheduledTime() == null
                        ? null
                        : habit.getScheduledTime().format(DateTimeFormatter.ofPattern("HH:mm")),
                habit.isReminderEnabled(),
                habit.isArchived(),
                habit.getCreatedAt(),
                habit.getUpdatedAt(),
                currentStreak,
                longestStreak
        );
    }
}
