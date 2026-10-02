package com.habituate.api.groups;

/**
 * periodStart/periodEnd as "YYYY-MM-DD" — computed client-side, same convention as goals' periodStart.
 * visibility: "PUBLIC" or "PRIVATE" (case-insensitive, normalized server-side; defaults to PRIVATE).
 */
public record CreateChallengeRequest(
        String name,
        String description,
        Integer targetCount,
        String periodStart,
        String periodEnd,
        String visibility
) {
}
