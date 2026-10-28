package com.habituate.api.coach;

/** Body for PATCH /api/coach/messages/{id}/reaction. A null/blank emoji clears the user's reaction on that message (tap-the-same-one-again-to-remove). */
public record ReactionRequest(String emoji) {
}
