package com.habituate.api.habits;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateHabitRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 100) String category,
        @Size(max = 50) String cadenceType,
        @Min(1) @Max(100000) Integer cadenceTarget,
        @Min(1) @Max(100000) Integer weeklyTarget,
        @Min(1) @Max(100000) Integer monthlyTarget,
        @Size(max = 20) String trackingMode,
        Boolean featuredGoal,
        @Size(max = 10) String scheduledTime,
        Boolean reminderEnabled,
        @Size(max = 500) String motivation,
        // Tower cap in days (SKYLINE.md section 6): null = the default of 30.
        @Min(value = 1, message = "Top out after must be between 1 and 35 days")
        @Max(value = 35, message = "Top out after must be between 1 and 35 days")
        Integer topOutThresholdDays
) {
    /** The create form's original shape, without a cap — keeps every existing
     * call site compiling and means "use the default of 30". */
    public CreateHabitRequest(
            String name, String category, String cadenceType, Integer cadenceTarget, Integer weeklyTarget,
            Integer monthlyTarget, String trackingMode, Boolean featuredGoal, String scheduledTime,
            Boolean reminderEnabled, String motivation) {
        this(name, category, cadenceType, cadenceTarget, weeklyTarget, monthlyTarget, trackingMode,
                featuredGoal, scheduledTime, reminderEnabled, motivation, null);
    }
}
