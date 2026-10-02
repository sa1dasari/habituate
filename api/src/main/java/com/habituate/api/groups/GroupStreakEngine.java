package com.habituate.api.groups;

import java.time.LocalDate;
import java.util.Collection;

/**
 * Pure streak-rule math — no Spring, no DB — mirroring CorrelationEngine's
 * separation of pure logic from the Kafka-consuming service.
 *
 * Bucketed in UTC (same documented limitation as the insights engine and
 * StreakCalculator's pre-timezone-header era): a group can span members in
 * different timezones, and there's no stored per-user timezone to pick one
 * over another — revisit once users.timezone exists.
 */
public final class GroupStreakEngine {

    private GroupStreakEngine() {
    }

    /** Whether the group's streak_rule is satisfied today, given each linked member's completion. */
    public static boolean qualifies(String streakRule, Collection<Boolean> memberCompletedToday) {
        if (memberCompletedToday.isEmpty()) {
            return false;
        }
        if (Group.ANY_MEMBER.equals(streakRule)) {
            return memberCompletedToday.stream().anyMatch(Boolean::booleanValue);
        }
        // ALL_MEMBERS (default/fallback)
        return memberCompletedToday.stream().allMatch(Boolean::booleanValue);
    }

    public record Result(int currentStreak, int longestStreak, LocalDate lastQualifyingDate, String status) {
    }

    /**
     * Recomputes a group's streak given whether today's rule is currently
     * satisfied. Idempotent against being called multiple times the same day
     * (every member's check-in re-triggers this) — only increments once per
     * calendar day. Does NOT reset a broken streak to 0 on its own; that's
     * StreakFreezeScheduler's job at day's end (apply a freeze, or let it
     * reset) — this function only ever grows the streak or marks it pending,
     * since it only runs in reaction to a check-in (a positive signal), never
     * in reaction to time simply passing.
     */
    public static Result recompute(
            boolean qualifiesToday,
            int previousCurrentStreak,
            int previousLongestStreak,
            LocalDate previousLastQualifyingDate,
            LocalDate today) {

        if (!qualifiesToday) {
            boolean stillPending = previousCurrentStreak > 0
                    && previousLastQualifyingDate != null
                    && previousLastQualifyingDate.equals(today.minusDays(1));
            String status = stillPending ? GroupStreak.AT_RISK : GroupStreak.ACTIVE;
            return new Result(previousCurrentStreak, previousLongestStreak, previousLastQualifyingDate, status);
        }

        if (previousLastQualifyingDate != null && previousLastQualifyingDate.equals(today)) {
            // Already counted today (an earlier event this same day already
            // flipped qualification) — don't double-increment.
            return new Result(previousCurrentStreak, previousLongestStreak, today, GroupStreak.ACTIVE);
        }

        boolean continuing = previousLastQualifyingDate != null
                && previousLastQualifyingDate.equals(today.minusDays(1));
        int newCurrent = continuing ? previousCurrentStreak + 1 : 1;
        int newLongest = Math.max(previousLongestStreak, newCurrent);

        return new Result(newCurrent, newLongest, today, GroupStreak.ACTIVE);
    }
}
