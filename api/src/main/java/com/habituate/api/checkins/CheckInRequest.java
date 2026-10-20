package com.habituate.api.checkins;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CheckInRequest(
        Instant occurredAt,
        @Min(1) @Max(100000) Integer value,
        @Size(max = 50) String source
) {
}
