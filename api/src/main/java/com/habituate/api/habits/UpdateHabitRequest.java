package com.habituate.api.habits;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/** name/category/cadenceType/scheduledTime are intentionally not @NotBlank — null/blank means
 * "don't change this field" per HabitService.updateHabit's sparse-patch handling, not "required". */
public record UpdateHabitRequest(
        @Size(max = 200) String name,
        @Size(max = 100) String category,
        @Size(max = 50) String cadenceType,
        @Min(1) @Max(100000) Integer cadenceTarget,
        @Min(1) @Max(100000) Integer weeklyTarget,
        @Min(1) @Max(100000) Integer monthlyTarget,
        @Size(max = 20) String trackingMode,
        Boolean featuredGoal,
        @Size(max = 10) String scheduledTime,
        Boolean reminderEnabled,
        Boolean archived,
        @Size(max = 500) String motivation,
        @Min(value = 1, message = "Top out after must be between 1 and 35 days") @Max(value = 35, message = "Top out after must be between 1 and 35 days") Integer topOutThresholdDays,
        // Tower colour palette key: null = leave unchanged, "" = clear back to the category colour.
        @Size(max = 20) String color,
        // Optional unit for a COUNT-mode habit's amount (e.g. "glasses"); null = leave
        // unchanged, "" = clear it. Display-only.
        @Size(max = 30) String unit
) {
    /** Shape before the unit field — keeps existing call sites compiling. */
    public UpdateHabitRequest(
            String name, String category, String cadenceType, Integer cadenceTarget, Integer weeklyTarget,
            Integer monthlyTarget, String trackingMode, Boolean featuredGoal, String scheduledTime,
            Boolean reminderEnabled, Boolean archived, String motivation, Integer topOutThresholdDays, String color) {
        this(name, category, cadenceType, cadenceTarget, weeklyTarget, monthlyTarget, trackingMode,
                featuredGoal, scheduledTime, reminderEnabled, archived, motivation, topOutThresholdDays, color, null);
    }

    /** Shape before per-habit colour — keeps existing call sites compiling. */
    public UpdateHabitRequest(
            String name, String category, String cadenceType, Integer cadenceTarget, Integer weeklyTarget,
            Integer monthlyTarget, String trackingMode, Boolean featuredGoal, String scheduledTime,
            Boolean reminderEnabled, Boolean archived, String motivation, Integer topOutThresholdDays) {
        this(name, category, cadenceType, cadenceTarget, weeklyTarget, monthlyTarget, trackingMode,
                featuredGoal, scheduledTime, reminderEnabled, archived, motivation, topOutThresholdDays, null, null);
    }
}
