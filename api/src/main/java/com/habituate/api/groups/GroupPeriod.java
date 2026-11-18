package com.habituate.api.groups;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/**
 * Period-boundary math for a WEEKLY/MONTHLY COOPERATIVE group (SKYLINE.md
 * decision #15). There's no existing backend precedent for a "period" —
 * StreakCalculator is day-by-day only, and mobile's utils/lots.js day-block
 * split (1-7/8-14/.../29-end) is a visual decision for a month tile's ring
 * count, not a streak-qualifying boundary. Plain calendar week (Mon-Sun) and
 * calendar month, UTC — matching GroupStreakUpdater/StreakFreezeScheduler's
 * existing `LocalDate.now(ZoneOffset.UTC)` convention.
 */
public final class GroupPeriod {

    private GroupPeriod() {
    }

    public static LocalDate periodStart(GroupCadence.Period period, LocalDate date) {
        return switch (period) {
            case DAILY -> date;
            case WEEKLY -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTHLY -> date.withDayOfMonth(1);
        };
    }

    public static LocalDate periodEnd(GroupCadence.Period period, LocalDate date) {
        return switch (period) {
            case DAILY -> date;
            case WEEKLY -> date.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
            case MONTHLY -> date.with(TemporalAdjusters.lastDayOfMonth());
        };
    }

    /** Whether the period containing `date` has fully elapsed as of `today`. */
    public static boolean isPeriodComplete(GroupCadence.Period period, LocalDate date, LocalDate today) {
        return periodEnd(period, date).isBefore(today);
    }

    /** The start of the period immediately following the one that starts on `periodStart`. */
    public static LocalDate nextPeriodStart(GroupCadence.Period period, LocalDate periodStart) {
        return switch (period) {
            case DAILY -> periodStart.plusDays(1);
            case WEEKLY -> periodStart.plusWeeks(1);
            case MONTHLY -> periodStart.plusMonths(1);
        };
    }

    /** The start of the period immediately before the one that starts on `periodStart`. */
    public static LocalDate previousPeriodStart(GroupCadence.Period period, LocalDate periodStart) {
        return switch (period) {
            case DAILY -> periodStart.minusDays(1);
            case WEEKLY -> periodStart.minusWeeks(1);
            case MONTHLY -> periodStart.minusMonths(1);
        };
    }

    /** `periodStart`, `count` whole periods earlier. */
    public static LocalDate minusPeriods(GroupCadence.Period period, LocalDate periodStart, int count) {
        return switch (period) {
            case DAILY -> periodStart.minusDays(count);
            case WEEKLY -> periodStart.minusWeeks(count);
            case MONTHLY -> periodStart.minusMonths(count);
        };
    }
}
