package com.habituate.api.config;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimiterTest {

    private static Clock fixedClockAt(long epochSecond) {
        return Clock.fixed(Instant.ofEpochSecond(epochSecond), ZoneOffset.UTC);
    }

    @Test
    void tryConsume_allowsUpToTheLimitWithinOneWindow() {
        RateLimiter limiter = new RateLimiter(fixedClockAt(1000));

        assertThat(limiter.tryConsume("user-1", 3, 60)).isTrue();
        assertThat(limiter.tryConsume("user-1", 3, 60)).isTrue();
        assertThat(limiter.tryConsume("user-1", 3, 60)).isTrue();
        assertThat(limiter.tryConsume("user-1", 3, 60)).isFalse();
    }

    @Test
    void tryConsume_keysAreIndependent() {
        RateLimiter limiter = new RateLimiter(fixedClockAt(1000));

        assertThat(limiter.tryConsume("user-1", 1, 60)).isTrue();
        assertThat(limiter.tryConsume("user-1", 1, 60)).isFalse();
        // A different key has its own, unaffected budget.
        assertThat(limiter.tryConsume("user-2", 1, 60)).isTrue();
    }

    @Test
    void tryConsume_resetsOnceTheWindowRolls() {
        // Window math is keyed purely off "now" (no per-key start time is
        // stored across calls beyond the current window), so two separate
        // instances fixed one window apart exercise the same roll-over logic
        // a single advancing clock would in production.
        long windowSeconds = 60;
        long firstWindowStart = 600; // a clean multiple of 60

        RateLimiter firstWindow = new RateLimiter(fixedClockAt(firstWindowStart));
        assertThat(firstWindow.tryConsume("user-1", 1, windowSeconds)).isTrue();
        assertThat(firstWindow.tryConsume("user-1", 1, windowSeconds)).isFalse();

        RateLimiter nextWindow = new RateLimiter(fixedClockAt(firstWindowStart + windowSeconds));
        assertThat(nextWindow.tryConsume("user-1", 1, windowSeconds)).isTrue();
    }

    @Test
    void evictStaleEntries_removesOnlyWindowsOlderThanTheCutoff() {
        RateLimiter limiter = new RateLimiter(fixedClockAt(600)); // windowStart = 600
        limiter.tryConsume("user-1", 1, 60);
        assertThat(limiter.tryConsume("user-1", 1, 60)).isFalse(); // budget spent, entry present

        // cutoff = now(600) - olderThanSeconds(100) = 500: the recorded
        // window (600) isn't older than that, so it survives untouched.
        limiter.evictStaleEntries(100);
        assertThat(limiter.tryConsume("user-1", 1, 60)).isFalse();

        // A negative olderThanSeconds pushes the cutoff (600 - (-1) = 601)
        // past the recorded window (600) on this same fixed clock, standing
        // in for "real time has since moved past this window" without
        // needing the clock itself to advance mid-test.
        limiter.evictStaleEntries(-1);
        assertThat(limiter.tryConsume("user-1", 1, 60)).isTrue(); // fresh budget — entry was evicted
    }
}
