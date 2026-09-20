package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Computes current and longest daily streaks from a list of check-ins.
 * A streak is a run of consecutive calendar days (UTC) with at least one check-in.
 * The current streak counts backward from today; if today has no check-in yet but
 * yesterday does, the streak is still live (at-risk, not broken).
 */
public final class StreakCalculator {

    private StreakCalculator() {}

    public record Streaks(int current, int longest) {}

    public static Streaks compute(List<CheckIn> checkIns) {
        if (checkIns == null || checkIns.isEmpty()) return new Streaks(0, 0);

        Set<LocalDate> days = new TreeSet<>();
        for (CheckIn c : checkIns) {
            days.add(toDate(c.getOccurredAt()));
        }

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
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

    private static LocalDate toDate(Instant instant) {
        return instant.atZone(ZoneOffset.UTC).toLocalDate();
    }
}
