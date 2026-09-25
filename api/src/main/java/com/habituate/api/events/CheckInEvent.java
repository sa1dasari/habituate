package com.habituate.api.events;

import java.time.Instant;

/**
 * Published to the `checkin-events` Kafka topic on every check-in write —
 * both logging one and undoing one, since both are writes to the source of
 * truth and the stream should mirror it exactly. This is the payload a
 * future Flink job (Phase 6) will consume to maintain rolling per-habit
 * completion state for the correlation engine; for now, CheckInEventLogger
 * is the only consumer, and it just logs.
 */
public record CheckInEvent(
        String eventType,
        Long checkInId,
        Long habitId,
        String userId,
        Instant occurredAt,
        Integer value,
        String source,
        Instant publishedAt
) {
    public static final String CREATED = "CREATED";
    public static final String DELETED = "DELETED";
}
