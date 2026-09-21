package com.habituate.api.goals;

/** periodStart ("YYYY-MM-DD") is computed client-side, consistent with how period
 * windows are already computed on the mobile side (mobile/utils/cadence.js) rather
 * than the server assuming a timezone the user's device may not share. */
public record CreateGoalRequest(
        String description,
        String period,
        Integer targetCount,
        String periodStart
) {
}
