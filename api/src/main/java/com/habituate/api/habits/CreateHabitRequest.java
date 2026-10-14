package com.habituate.api.habits;

public record CreateHabitRequest(
        String name,
        String category,
        String cadenceType,
        Integer cadenceTarget,
        Integer weeklyTarget,
        Integer monthlyTarget,
        String trackingMode,
        Boolean featuredGoal,
        String scheduledTime,
        Boolean reminderEnabled
) {
}
