package com.habituate.api.coach;

/** Per-habit stats handed to the model as grounding data — computed, not raw check-in dumps. */
public record HabitSnapshot(
        Long id,
        String name,
        String category,
        String trackingMode,
        Integer cadenceTarget,
        Integer weeklyTarget,
        Integer monthlyTarget,
        int currentStreak,
        int longestStreak,
        int completedLast7,
        int possibleLast7,
        int completedLast30,
        int possibleLast30
) {
}
