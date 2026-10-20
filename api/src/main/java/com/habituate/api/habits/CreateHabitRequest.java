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
        Boolean reminderEnabled
) {
}
