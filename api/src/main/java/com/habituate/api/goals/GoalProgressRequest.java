package com.habituate.api.goals;

/** delta is signed — +1 for a tap on "+", -1 for "-". Result is clamped to >= 0. */
public record GoalProgressRequest(Integer delta) {
}
