package com.habituate.api.groups;

import java.time.Instant;

/**
 * One feed row: a groupmate's completion of their own linked habit.
 * Deliberately not a generic "friend activity feed" — scoped to check-ins
 * already visible via a shared group (CheckIn.groupId), not every habit a
 * friend happens to track, which would leak private data just from being
 * friends. See CLAUDE.md's groups/social architecture note.
 */
public record GroupActivityItem(
        Long checkInId,
        String userId,
        String userName,
        String habitName,
        Instant occurredAt,
        int cheerCount,
        boolean cheeredByMe
) {
}
