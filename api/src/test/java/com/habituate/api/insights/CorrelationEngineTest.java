package com.habituate.api.insights;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.habits.Habit;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CorrelationEngineTest {

    private static Instant atUtc(LocalDate day, int hour) {
        return day.atTime(hour, 0).atZone(ZoneOffset.UTC).toInstant();
    }

    private static Habit booleanHabit() {
        Habit habit = new Habit("user", "Habit", "General", "DAILY", 1);
        return habit;
    }

    private static Habit countHabit(int cadenceTarget) {
        Habit habit = new Habit("user", "Habit", "General", "DAILY", cadenceTarget);
        habit.setTrackingMode("COUNT");
        return habit;
    }

    @Test
    void completedDays_booleanHabit_anyCheckInCounts() {
        Habit habit = booleanHabit();
        LocalDate day = LocalDate.of(2026, 1, 10);
        List<CheckIn> checkIns = List.of(new CheckIn(1L, "user", atUtc(day, 9), 1, "manual"));

        Set<LocalDate> days = CorrelationEngine.completedDays(habit, checkIns, atUtc(day.minusDays(1), 0));

        assertThat(days).containsExactly(day);
    }

    @Test
    void completedDays_countHabit_requiresDailyTargetSum() {
        Habit habit = countHabit(3);
        LocalDate day = LocalDate.of(2026, 1, 10);
        List<CheckIn> checkIns = List.of(
                new CheckIn(1L, "user", atUtc(day, 9), 1, "manual"),
                new CheckIn(1L, "user", atUtc(day, 14), 1, "manual")
        );

        // Only 2 of the required 3 logged that day — shouldn't count as completed.
        Set<LocalDate> days = CorrelationEngine.completedDays(habit, checkIns, atUtc(day.minusDays(1), 0));
        assertThat(days).isEmpty();

        List<CheckIn> enough = List.of(
                new CheckIn(1L, "user", atUtc(day, 9), 2, "manual"),
                new CheckIn(1L, "user", atUtc(day, 14), 1, "manual")
        );
        Set<LocalDate> daysEnough = CorrelationEngine.completedDays(habit, enough, atUtc(day.minusDays(1), 0));
        assertThat(daysEnough).containsExactly(day);
    }

    @Test
    void completedDays_excludesCheckInsBeforeWindow() {
        Habit habit = booleanHabit();
        LocalDate inWindow = LocalDate.of(2026, 1, 20);
        LocalDate beforeWindow = LocalDate.of(2026, 1, 1);
        List<CheckIn> checkIns = List.of(
                new CheckIn(1L, "user", atUtc(inWindow, 9), 1, "manual"),
                new CheckIn(1L, "user", atUtc(beforeWindow, 9), 1, "manual")
        );

        Set<LocalDate> days = CorrelationEngine.completedDays(habit, checkIns, atUtc(LocalDate.of(2026, 1, 10), 0));

        assertThat(days).containsExactly(inWindow);
    }

    @Test
    void correlate_perfectMatch() {
        Set<LocalDate> daysA = Set.of(
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2), LocalDate.of(2026, 1, 3),
                LocalDate.of(2026, 1, 4), LocalDate.of(2026, 1, 5));
        Set<LocalDate> daysB = Set.of(
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2), LocalDate.of(2026, 1, 3),
                LocalDate.of(2026, 1, 4), LocalDate.of(2026, 1, 5));

        CorrelationEngine.PairResult result = CorrelationEngine.correlate(daysA, daysB);

        assertThat(result.score()).isEqualTo(1.0);
        assertThat(result.sampleSize()).isEqualTo(5);
        assertThat(result.matches()).isEqualTo(5);
    }

    @Test
    void correlate_partialMatch() {
        Set<LocalDate> daysA = Set.of(
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2), LocalDate.of(2026, 1, 3), LocalDate.of(2026, 1, 4));
        Set<LocalDate> daysB = Set.of(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 2), LocalDate.of(2026, 1, 9));

        CorrelationEngine.PairResult result = CorrelationEngine.correlate(daysA, daysB);

        assertThat(result.sampleSize()).isEqualTo(4);
        assertThat(result.matches()).isEqualTo(2);
        assertThat(result.score()).isEqualTo(0.5);
    }

    @Test
    void correlate_emptySampleIsZeroNotDivideByZeroCrash() {
        CorrelationEngine.PairResult result = CorrelationEngine.correlate(Set.of(), Set.of(LocalDate.of(2026, 1, 1)));

        assertThat(result.sampleSize()).isEqualTo(0);
        assertThat(result.score()).isEqualTo(0.0);
    }
}
