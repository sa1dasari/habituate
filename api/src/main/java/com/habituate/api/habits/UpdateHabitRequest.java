package com.habituate.api.habits;

public record UpdateHabitRequest(
        String name,
        String category,
        String cadenceType,
        Integer cadenceTarget,
        Boolean archived
) {
}
