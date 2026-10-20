package com.habituate.api.groups;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * streakRule: "ALL_MEMBERS" or "ANY_MEMBER" (case-insensitive, normalized server-side; default ALL_MEMBERS).
 * goalAlignment: "UNIFIED" or "SPLIT" (default UNIFIED).
 * trackingMode: "COOPERATIVE" (one shared streak, default) or "INDEPENDENT" (each member's own streak, no shared counter).
 * visibilityLevel: "FULL_DETAILS" (default) or "STATUS_ONLY".
 * nudgesEnabled: whether groupmates may nudge each other (default true).
 * skipDaysPerMonth: how many group-grace freezes are allowed in a rolling 30 days (default 1, 0-3 accepted).
 *
 * This same record is reused for both create and update (GroupService.createGroup/updateGroup),
 * so name is @NotBlank on both paths — unlike habits' sparse-patch update, a shared habit's name
 * is always required when this request is sent.
 */
public record CreateGroupRequest(
        @NotBlank @Size(max = 200) String name,
        Long habitId,
        @Size(max = 50) String streakRule,
        @Size(max = 50) String goalAlignment,
        @Size(max = 50) String trackingMode,
        @Size(max = 50) String visibilityLevel,
        Boolean nudgesEnabled,
        @Min(0) @Max(3) Integer skipDaysPerMonth
) {
    public CreateGroupRequest(String name, Long habitId, String streakRule) {
        this(name, habitId, streakRule, null, null, null, null, null);
    }
}
