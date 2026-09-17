package com.habituate.api.habits;

public record UpdateHabitRequest(
        String name,
        String category,
        String cadenceType,
        Integer cadenceTarget,
        String scheduledTime,
        Boolean reminderEnabled,
        Boolean archived
) {
}
