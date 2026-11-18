package com.habituate.api.groups;

import java.time.LocalDate;
import java.util.Collection;

/**
 * Pure streak-rule math — no Spring, no DB — same separation of pure logic
 * from the service layer used by the former CorrelationEngine
 * (removed 2026-10-04, see CLAUDE.md).
 *
 * Bucketed in UTC: a group can span members in different timezones, and
 * this engine has no way to pick one over another for "today." users.timezone
 * now exists (added for ReminderScheduler) but GroupStreakUpdater doesn't
 * use it yet — worth revisiting, not done as part of this change.
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
     * Recomputes a group's streak given whether the current period's rule is
     * currently satisfied. `period`/`currentPeriodStart` generalize what used
     * to be a bare "today": for DAILY, currentPeriodStart IS today and this
     * behaves exactly as before. For WEEKLY/MONTHLY (SKYLINE.md #15),
     * `lastQualifyingDate` holds the START of the last period that fully
     * qualified, not a literal day. A member's period qualification (raw
     * check-in count so far >= their target) is monotonic within a period —
     * once every member has crossed their target the group qualifies for
     * real, even before the period ends — so this can still run reactively
     * off every check-in, exactly like the daily case. What it still can't
     * do is notice a period CLOSING without qualifying (no check-in ever
     * fires for that) — StreakFreezeScheduler owns that close-out, same as
     * it always has for days, just period-aware now too.
     */
    public static Result recompute(
            GroupCadence.Period period,
            boolean qualifiesForCurrentPeriod,
            int previousCurrentStreak,
            int previousLongestStreak,
            LocalDate previousLastQualifyingDate,
            LocalDate currentPeriodStart) {

        if (!qualifiesForCurrentPeriod) {
            boolean stillPending = previousCurrentStreak > 0
                    && previousLastQualifyingDate != null
                    && previousLastQualifyingDate.equals(GroupPeriod.previousPeriodStart(period, currentPeriodStart));
            String status = stillPending ? GroupStreak.AT_RISK : GroupStreak.ACTIVE;
            return new Result(previousCurrentStreak, previousLongestStreak, previousLastQualifyingDate, status);
        }

        if (previousLastQualifyingDate != null && previousLastQualifyingDate.equals(currentPeriodStart)) {
            // Already counted this period (an earlier event already flipped
            // qualification) — don't double-increment.
            return new Result(previousCurrentStreak, previousLongestStreak, currentPeriodStart, GroupStreak.ACTIVE);
        }

        boolean continuing = previousLastQualifyingDate != null
                && previousLastQualifyingDate.equals(GroupPeriod.previousPeriodStart(period, currentPeriodStart));
        int newCurrent = continuing ? previousCurrentStreak + 1 : 1;
        int newLongest = Math.max(previousLongestStreak, newCurrent);

        return new Result(newCurrent, newLongest, currentPeriodStart, GroupStreak.ACTIVE);
    }
}
