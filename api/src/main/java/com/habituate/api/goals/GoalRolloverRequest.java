package com.habituate.api.goals;

/** New period start ("YYYY-MM-DD"), client-computed the same way as on create. */
public record GoalRolloverRequest(String periodStart) {
}
