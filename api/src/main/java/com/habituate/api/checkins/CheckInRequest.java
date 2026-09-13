package com.habituate.api.checkins;

import java.time.Instant;

public record CheckInRequest(
        Instant occurredAt,
        Integer value,
        String source
) {
}
