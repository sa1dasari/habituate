package com.habituate.api.groups;

/**
 * streakRule: "ALL_MEMBERS" or "ANY_MEMBER" (case-insensitive, normalized server-side; default ALL_MEMBERS).
 * goalAlignment: "UNIFIED" or "SPLIT" (default UNIFIED).
 * trackingMode: "COOPERATIVE" (one shared streak, default) or "INDEPENDENT" (each member's own streak, no shared counter).
 * visibilityLevel: "FULL_DETAILS" (default) or "STATUS_ONLY".
 * nudgesEnabled: whether groupmates may nudge each other (default true).
 * skipDaysPerMonth: how many group-grace freezes are allowed in a rolling 30 days (default 1, 0-3 accepted).
 */
public record CreateGroupRequest(
        String name,
        Long habitId,
        String streakRule,
        String goalAlignment,
        String trackingMode,
        String visibilityLevel,
        Boolean nudgesEnabled,
        Integer skipDaysPerMonth
) {
    public CreateGroupRequest(String name, Long habitId, String streakRule) {
        this(name, habitId, streakRule, null, null, null, null, null);
    }
}
