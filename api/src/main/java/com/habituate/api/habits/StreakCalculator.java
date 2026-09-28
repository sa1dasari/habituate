package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Computes current and longest daily streaks from a list of check-ins.
 * A streak is a run of consecutive calendar days, bucketed in the caller's
 * zone, with at least one check-in. The current streak counts backward from
 * today; if today has no check-in yet but yesterday does, the streak is
 * still live (at-risk, not broken).
 *
 * The zone matters: mobile's own calendar/streak math (CalendarModal.js,
 * cadence.js) buckets by device-local time, so computing here in UTC would
 * disagree with what the app shows for any user far enough from UTC that a
 * late-evening check-in already rolls into the next UTC day.
 */
public final class StreakCalculator {

    private StreakCalculator() {}

    public record Streaks(int current, int longest) {}

    public static Streaks compute(List<CheckIn> checkIns) {
        return compute(checkIns, ZoneOffset.UTC, Instant.now());
    }

    public static Streaks compute(List<CheckIn> checkIns, ZoneId zone) {
        return compute(checkIns, zone, Instant.now());
    }

    /** @param now injectable so tests can pin "today" instead of racing the wall clock. */
    public static Streaks compute(List<CheckIn> checkIns, ZoneId zone, Instant now) {
        if (checkIns == null || checkIns.isEmpty()) return new Streaks(0, 0);

        Set<LocalDate> days = new TreeSet<>();
        for (CheckIn c : checkIns) {
            days.add(toDate(c.getOccurredAt(), zone));
        }

        LocalDate today = now.atZone(zone).toLocalDate();
        LocalDate cursor = days.contains(today) ? today : today.minusDays(1);

        // Current streak: walk backward from cursor while consecutive days exist.
        int current = 0;
        while (days.contains(cursor)) {
            current++;
            cursor = cursor.minusDays(1);
        }

        // Longest streak: scan all days in ascending order.
        int longest = 0;
        int run = 0;
        LocalDate prev = null;
        for (LocalDate day : days) {
            if (prev != null && day.equals(prev.plusDays(1))) {
                run++;
            } else {
                run = 1;
            }
            if (run > longest) longest = run;
            prev = day;
        }

        return new Streaks(current, Math.max(longest, current));
    }

    private static LocalDate toDate(Instant instant, ZoneId zone) {
        return instant.atZone(zone).toLocalDate();
    }
}
