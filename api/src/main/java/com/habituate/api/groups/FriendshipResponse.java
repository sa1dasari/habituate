package com.habituate.api.groups;

import java.time.Instant;

/** otherUserId/otherUserName/otherUserEmail are resolved relative to the viewing user — whichever side isn't "me". */
public record FriendshipResponse(
        Long id,
        String otherUserId,
        String otherUserName,
        String otherUserEmail,
        String status,
        Instant createdAt
) {
}
