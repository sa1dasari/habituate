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

    /**
     * lift = score / baseRateB — how much more likely B is on an A-day than
     * on an arbitrary day. Without this, a habit B that's just generally
     * frequent (done most days regardless of A) looks like a strong "pattern"
     * purely from its own base rate, e.g. two unrelated habits that both
     * happen ~4 days a week will show ~60-70% co-occurrence by coincidence
     * alone. lift close to 1 means A isn't actually predictive of B.
     */
    public record PairResult(double score, int sampleSize, int matches, double baseRateB, double lift) {
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
     * B was also completed on — plus B's unconditional base rate over the
     * same window and the resulting lift. sampleSize is the number of days A
     * was completed; callers should suppress low-sample-size results rather
     * than surfacing a "90% match" built on a handful of days, and low-lift
     * results rather than surfacing two habits that just happen to both be
     * frequent.
     */
    public static PairResult correlate(Set<LocalDate> daysA, Set<LocalDate> daysB, int windowDays) {
        double baseRateB = windowDays > 0 ? (double) daysB.size() / windowDays : 0;

        int sampleSize = daysA.size();
        if (sampleSize == 0) {
            return new PairResult(0, 0, 0, baseRateB, 0);
        }

        int matches = 0;
        for (LocalDate day : daysA) {
            if (daysB.contains(day)) {
                matches++;
            }
        }
        double score = (double) matches / sampleSize;
        double lift = baseRateB > 0 ? score / baseRateB : (score > 0 ? Double.POSITIVE_INFINITY : 0);

        return new PairResult(score, sampleSize, matches, baseRateB, lift);
    }
}
