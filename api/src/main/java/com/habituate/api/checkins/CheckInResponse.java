package com.habituate.api.checkins;

import java.time.Instant;

public record CheckInResponse(
        Long id,
        Long habitId,
        String userId,
        Instant occurredAt,
        Integer value,
        String source
) {
    public static CheckInResponse from(CheckIn checkIn) {
        return new CheckInResponse(
                checkIn.getId(),
                checkIn.getHabitId(),
                checkIn.getUserId(),
                checkIn.getOccurredAt(),
                checkIn.getValue(),
                checkIn.getSource()
        );
    }
}
