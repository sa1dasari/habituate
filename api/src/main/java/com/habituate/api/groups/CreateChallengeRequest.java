package com.habituate.api.groups;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * periodStart/periodEnd as "YYYY-MM-DD" — computed client-side, same convention as goals' periodStart.
 * periodEnd may be null/blank for an open-ended challenge (no fixed end date).
 * visibility: "PUBLIC" or "PRIVATE" (case-insensitive, normalized server-side; defaults to PRIVATE).
 * icon/color: free-form, optional visual anchor — not validated against a fixed set.
 * trackingMode: "BOOLEAN" (check-off, default) or "COUNT" (quantitative/time goal).
 * cadenceType: "DAILY" (default), "WEEKLY_QUOTA" (needs weeklyQuota), or "CUSTOM_DAYS" (needs customDays).
 * weeklyQuota: required when cadenceType is WEEKLY_QUOTA, e.g. 3 (times a week).
 * customDays: required when cadenceType is CUSTOM_DAYS, CSV of ISO weekday numbers, e.g. "1,3,5".
 * reminderTime: "HH:mm", optional — when set, every participant gets a daily nudge at that local time.
 *
 * Reused for both create and update (ChallengeService.create/update), so name is @NotBlank on
 * both paths, matching the service's own "Challenge name is required" check on each.
 */
public record CreateChallengeRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 1000) String description,
        @Min(1) @Max(100000) Integer targetCount,
        @Size(max = 10) String periodStart,
        @Size(max = 10) String periodEnd,
        @Size(max = 20) String visibility,
        @Size(max = 100) String icon,
        @Size(max = 20) String color,
        @Size(max = 20) String trackingMode,
        @Size(max = 50) String cadenceType,
        @Min(1) @Max(7) Integer weeklyQuota,
        @Size(max = 50) String customDays,
        @Size(max = 10) String reminderTime
) {
}
