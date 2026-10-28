package com.habituate.api.coach;

/**
 * POST /api/coach/messages now returns BOTH turns, not just the assistant's
 * reply — the mobile client needs the persisted userMessage (its real id and
 * server-computed aiReaction) rather than the client-generated local
 * placeholder it optimistically renders while the request is in flight.
 */
public record AskCoachResponse(CoachMessageResponse userMessage, CoachMessageResponse assistantMessage) {
}
