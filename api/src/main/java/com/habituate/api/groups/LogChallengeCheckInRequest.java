package com.habituate.api.groups;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** value is only meaningful for a COUNT-tracking-mode challenge; ignored (treated as 1) for BOOLEAN. */
public record LogChallengeCheckInRequest(@Min(1) @Max(1000000) Integer value) {
}
