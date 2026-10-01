package com.habituate.api.insights;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.habits.Habit;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Pure correlation math — no Spring, no DB — so it's trivial to unit test.
 *
 * "Completed on day d" uses cadenceTarget as a uniform per-day bar: for a
 * BOOLEAN habit that's just "any check-in that day" (cadenceTarget defaults
 * to 1); for a COUNT habit it's "the day's logged values sum to at least
 * cadenceTarget". This deliberately doesn't replicate mobile's full
 * daily/weekly/monthly section logic (utils/cadence.js) — correlation cares
 * about "did you do X today", not which section of the Habits page X lives
 * in.
 *
 * Bucketed in UTC: this runs as a server-initiated nightly job with no
 * request to carry a client timezone (unlike StreakCalculator, which reads
 * X-Timezone off an actual HTTP request). Revisit once users.timezone exists
 * — see CLAUDE.md's data model.
 */
public final class CorrelationEngine {

    private CorrelationEngine() {
    }

    public record PairResult(double score, int sampleSize, int matches) {
    }

    /** The set of calendar days (UTC) on or after `since` where `habit` hit its daily bar. */
    public static Set<LocalDate> completedDays(Habit habit, List<CheckIn> checkIns, Instant since) {
        Map<LocalDate, Integer> totalsByDay = new HashMap<>();
        for (CheckIn c : checkIns) {
            if (c.getOccurredAt().isBefore(since)) continue;
            LocalDate day = c.getOccurredAt().atZone(ZoneOffset.UTC).toLocalDate();
            int value = c.getValue() == null ? 1 : c.getValue();
            totalsByDay.merge(day, value, Integer::sum);
        }

        int target = habit.getCadenceTarget() == null || habit.getCadenceTarget() < 1 ? 1 : habit.getCadenceTarget();
        Set<LocalDate> days = new HashSet<>();
        for (Map.Entry<LocalDate, Integer> entry : totalsByDay.entrySet()) {
            if (entry.getValue() >= target) {
                days.add(entry.getKey());
            }
        }
        return days;
    }

    /**
     * P(B completed | A completed) — the fraction of A's completed days that
     * B was also completed on. sampleSize is the number of days A was
     * completed; callers should suppress low-sample-size results rather than
     * surfacing a "90% match" built on a handful of days.
     */
    public static PairResult correlate(Set<LocalDate> daysA, Set<LocalDate> daysB) {
        int sampleSize = daysA.size();
        if (sampleSize == 0) {
            return new PairResult(0, 0, 0);
        }
        int matches = 0;
        for (LocalDate day : daysA) {
            if (daysB.contains(day)) {
                matches++;
            }
        }
        return new PairResult((double) matches / sampleSize, sampleSize, matches);
    }
}
