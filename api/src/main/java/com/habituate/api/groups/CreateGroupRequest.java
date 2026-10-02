package com.habituate.api.groups;

/** streakRule: "ALL_MEMBERS" or "ANY_MEMBER" (case-insensitive, normalized server-side). */
public record CreateGroupRequest(String name, Long habitId, String streakRule) {
}
