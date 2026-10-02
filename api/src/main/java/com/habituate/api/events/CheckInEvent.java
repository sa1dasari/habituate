package com.habituate.api.events;

import java.time.Instant;

/**
 * Published to the `checkin-events` Kafka topic on every check-in write —
 * both logging one and undoing one, since both are writes to the source of
 * truth and the stream should mirror it exactly. This is the payload a
 * future Flink job (Phase 6) will consume to maintain rolling per-habit
 * completion state for the correlation engine. Current consumers:
 * CheckInEventLogger (just logs) and groups.GroupStreakConsumer (recomputes
 * a group's streak when a group-linked habit's check-in arrives) — per
 * CLAUDE.md, groups are "just a filtered consumer of the same events," not a
 * separate pipeline, which is why groupId rides on this same event instead
 * of a second topic.
 */
public record CheckInEvent(
        String eventType,
        Long checkInId,
        Long habitId,
        String userId,
        Instant occurredAt,
        Integer value,
        String source,
        Long groupId,
        Instant publishedAt
) {
    public static final String CREATED = "CREATED";
    public static final String DELETED = "DELETED";
}
