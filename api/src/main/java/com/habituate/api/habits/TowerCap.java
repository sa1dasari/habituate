package com.habituate.api.habits;

import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;

/**
 * Pure rules for a tower's cap (SKYLINE.md section 6): each tower tops out on
 * its own once it has stood `cap` local calendar days, and the cap is at most
 * {@link #MAX_CAP_DAYS}. Kept free of Spring/JPA, same split as
 * StreakCalculator, so the day arithmetic is unit-testable on its own.
 *
 * A tower started at any instant on local date D has one floor per local
 * calendar day from D, so with a cap of N it holds exactly N floors (D ..
 * D+N-1) and tops out at the local midnight that starts D+N.
 */
final class TowerCap {

    static final int DEFAULT_CAP_DAYS = 30;
    static final int MAX_CAP_DAYS = 35;
    static final int MIN_CAP_DAYS = 1;

    /** Hard stop on the catch-up search (about 11 years of 1-day caps). */
    private static final int MAX_BOUNDARY_STEPS = 4000;

    private TowerCap() {
    }

    /** A stored cap outside 1..35 is read as the nearest valid one, never trusted blindly. */
    static int effectiveCap(int capDays) {
        return Math.max(MIN_CAP_DAYS, Math.min(MAX_CAP_DAYS, capDays));
    }

    static boolean isValidCap(int capDays) {
        return capDays >= MIN_CAP_DAYS && capDays <= MAX_CAP_DAYS;
    }

    /** The local midnight at which a tower started at {@code segmentStart} reaches its cap. */
    static Instant boundary(Instant segmentStart, int capDays, ZoneId zone) {
        return segmentStart.atZone(zone).toLocalDate()
                .plusDays(effectiveCap(capDays))
                .atStartOfDay(zone)
                .toInstant();
    }

    /**
     * The latest cap boundary that has already passed by {@code now}, if any.
     * A tower can be several caps overdue (the server was down, or an old
     * habit met this rule for the first time); it is closed ONCE at the most
     * recent boundary rather than once per missed one, so a long-running
     * habit tops out a single time and the new tower starts at that boundary.
     */
    static Optional<Instant> latestDueBoundary(Instant segmentStart, int capDays, ZoneId zone, Instant now) {
        Instant start = segmentStart;
        Instant latest = null;
        for (int i = 0; i < MAX_BOUNDARY_STEPS; i += 1) {
            Instant next = boundary(start, capDays, zone);
            if (next.isAfter(now)) {
                break;
            }
            latest = next;
            start = next;
        }
        return Optional.ofNullable(latest);
    }
}
