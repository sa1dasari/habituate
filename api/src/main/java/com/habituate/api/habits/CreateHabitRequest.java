package com.habituate.api.habits;

public record CreateHabitRequest(
        String name,
        String category,
        String cadenceType,
        Integer cadenceTarget
) {
}
