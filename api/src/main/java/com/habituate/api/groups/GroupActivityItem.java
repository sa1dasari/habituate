package com.habituate.api.groups;

import java.time.Instant;

/**
 * One feed row: a groupmate's completion of their own linked habit.
 * Deliberately not a generic "friend activity feed" — scoped to check-ins
 * already visible via a shared group (CheckIn.groupId), not every habit a
 * friend happens to track, which would leak private data just from being
 * friends. See CLAUDE.md's groups/social architecture note.
 */
/** value is the check-in's logged amount, but only ever populated when the owning group's
 * visibilityLevel is FULL_DETAILS — a STATUS_ONLY group always sends null here, so the
 * client can only ever render a binary completed/not, per the "Privacy & Transparency
 * Levels" setting on Shared Habit creation. */
public record GroupActivityItem(
        Long checkInId,
        String userId,
        String userName,
        String habitName,
        Instant occurredAt,
        Integer value,
        int cheerCount,
        boolean cheeredByMe
) {
}
