package com.habituate.api.notifications;

import java.time.Instant;

public record AppNotificationResponse(
        Long id,
        String type,
        String title,
        String body,
        Long groupId,
        Long challengeId,
        Long habitId,
        boolean read,
        Instant createdAt
) {
}
