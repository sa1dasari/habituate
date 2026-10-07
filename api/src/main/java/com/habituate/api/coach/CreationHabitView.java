package com.habituate.api.coach;

/** Parsed view of a CREATE_HABIT proposal's JSON payload, for the mobile Confirm card. */
public record CreationHabitView(
        String name,
        String category,
        Integer cadenceTarget,
        Integer weeklyTarget,
        Integer monthlyTarget,
        String trackingMode
) {
}
