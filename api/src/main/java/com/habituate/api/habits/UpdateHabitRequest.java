package com.habituate.api.habits;

public record UpdateHabitRequest(
        String name,
        String category,
        String cadenceType,
        Integer cadenceTarget,
        Integer weeklyTarget,
        Integer monthlyTarget,
        String trackingMode,
        Boolean featuredGoal,
        String scheduledTime,
        Boolean reminderEnabled,
        Boolean archived
) {
}
