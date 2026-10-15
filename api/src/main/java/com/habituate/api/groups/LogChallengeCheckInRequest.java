package com.habituate.api.groups;

/** value is only meaningful for a COUNT-tracking-mode challenge; ignored (treated as 1) for BOOLEAN. */
public record LogChallengeCheckInRequest(Integer value) {
}
