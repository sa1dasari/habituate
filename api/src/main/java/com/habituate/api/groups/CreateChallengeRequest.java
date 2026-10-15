package com.habituate.api.groups;

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
 */
public record CreateChallengeRequest(
        String name,
        String description,
        Integer targetCount,
        String periodStart,
        String periodEnd,
        String visibility,
        String icon,
        String color,
        String trackingMode,
        String cadenceType,
        Integer weeklyQuota,
        String customDays,
        String reminderTime
) {
}
