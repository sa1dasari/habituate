package com.habituate.api.config;

import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fixed-window request counter, keyed by caller-supplied string (a userId or
 * an IP). Pure/testable on its own — no Spring, no servlet types — per
 * CLAUDE.md's "keep pure logic separate" convention (same shape as
 * StreakCalculator).
 *
 * In-memory and per-instance: correct for the single Railway instance v1
 * runs on today, but a second instance would each get its own counter,
 * effectively doubling every limit. Revisit with a shared store (Redis) if
 * the backend ever scales horizontally — not needed for v1.
 */
public class RateLimiter {

    private record Window(long windowStart, int count) {}

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public RateLimiter() {
        this(Clock.systemUTC());
    }

    public RateLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * True if this call is allowed under {@code maxRequests} per
     * {@code windowSeconds}-second fixed window for {@code key}; false if the
     * window's budget is already spent. A fixed (not sliding) window: the
     * count resets the instant a new window starts rather than decaying
     * continuously, which can allow a short burst right at the boundary —
     * an accepted tradeoff for how simple this needs to be for v1 (a sliding
     * window needs a timestamp list per key, not a single counter).
     */
    public boolean tryConsume(String key, int maxRequests, long windowSeconds) {
        long now = clock.instant().getEpochSecond();
        long currentWindowStart = now - (now % windowSeconds);

        Window updated = windows.compute(key, (k, existing) -> {
            if (existing == null || existing.windowStart() != currentWindowStart) {
                return new Window(currentWindowStart, 1);
            }
            return new Window(currentWindowStart, existing.count() + 1);
        });

        return updated.count() <= maxRequests;
    }

    /** Drops windows older than any plausible in-flight request — call periodically, not per-request. */
    public void evictStaleEntries(long olderThanSeconds) {
        long cutoff = clock.instant().getEpochSecond() - olderThanSeconds;
        windows.entrySet().removeIf(e -> e.getValue().windowStart() < cutoff);
    }
}
