package com.habituate.api.coach;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.habits.Habit;
import com.habituate.api.habits.StreakCalculator;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Builds the grounding data sent to the model — per-habit completion stats,
 * not the user's raw check-in history (per SKILLS.md Phase 10's explicit
 * design question: "the referenced habit's recent completion stats, not the
 * user's full raw history"). "Active that day" is deliberately a single
 * uniform rule (any logged value > 0) across BOOLEAN and COUNT habits,
 * mirroring StreakCalculator's day-bucketing rather than mobile's fuller
 * per-cadence-target logic — approximate-but-always-correct grounding stats
 * are good enough for a coach reply; they don't need to be pixel-exact with
 * the Insights ring.
 */
public final class CoachContextBuilder {

    private CoachContextBuilder() {
    }

    public static List<HabitSnapshot> buildSnapshots(List<Habit> habits, CheckInRepository checkInRepository, ZoneId zone) {
        Instant now = Instant.now();
        LocalDate today = now.atZone(zone).toLocalDate();

        List<HabitSnapshot> snapshots = new ArrayList<>();
        for (Habit habit : habits) {
            List<CheckIn> checkIns = checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtDesc(habit.getUserId(), habit.getId());
            StreakCalculator.Streaks streaks = StreakCalculator.compute(checkIns, zone, now);
            LocalDate habitCreated = habit.getCreatedAt().atZone(zone).toLocalDate();

            Set<LocalDate> activeDays = new HashSet<>();
            for (CheckIn checkIn : checkIns) {
                if (checkIn.getValue() != null && checkIn.getValue() > 0) {
                    activeDays.add(checkIn.getOccurredAt().atZone(zone).toLocalDate());
                }
            }

            int[] last7 = windowStats(today, 7, habitCreated, activeDays);
            int[] last30 = windowStats(today, 30, habitCreated, activeDays);

            snapshots.add(new HabitSnapshot(
                    habit.getId(), habit.getName(), habit.getCategory(), habit.getTrackingMode(),
                    habit.getCadenceTarget(), habit.getWeeklyTarget(), habit.getMonthlyTarget(),
                    streaks.current(), streaks.longest(),
                    last7[0], last7[1], last30[0], last30[1]
            ));
        }
        return snapshots;
    }

    /** @return {completedDays, possibleDays} over the window ending today, only counting days the habit existed. */
    private static int[] windowStats(LocalDate today, int windowDays, LocalDate habitCreated, Set<LocalDate> activeDays) {
        int completed = 0;
        int possible = 0;
        for (int i = 0; i < windowDays; i++) {
            LocalDate day = today.minusDays(i);
            if (day.isBefore(habitCreated)) continue;
            possible++;
            if (activeDays.contains(day)) completed++;
        }
        return new int[]{completed, possible};
    }
}
