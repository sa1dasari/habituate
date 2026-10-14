package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.groups.StreakFreeze;
import com.habituate.api.groups.StreakFreezeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Mirrors StreakFreezeScheduler (the group version) for personal habits —
 * Shield Days. For each non-archived habit, checks whether yesterday broke
 * an active streak; if so, auto-applies a Shield freeze if the user has one
 * banked (ShieldAwardService), otherwise leaves it — the streak just shows
 * as broken next time it's computed, same as today's behavior with no
 * freeze row for that gap day. Bucketed in UTC, same documented caveat as
 * the group scheduler and the insights engine.
 */
@Component
public class PersonalStreakFreezeScheduler {

    private static final Logger log = LoggerFactory.getLogger(PersonalStreakFreezeScheduler.class);

    private final HabitRepository habitRepository;
    private final CheckInRepository checkInRepository;
    private final StreakFreezeRepository streakFreezeRepository;
    private final ShieldAwardService shieldAwardService;

    public PersonalStreakFreezeScheduler(
            HabitRepository habitRepository,
            CheckInRepository checkInRepository,
            StreakFreezeRepository streakFreezeRepository,
            ShieldAwardService shieldAwardService) {
        this.habitRepository = habitRepository;
        this.checkInRepository = checkInRepository;
        this.streakFreezeRepository = streakFreezeRepository;
        this.shieldAwardService = shieldAwardService;
    }

    /** Offset from the group sweep (:05) so the two daily jobs don't contend for the same rows at once. */
    @Scheduled(cron = "0 10 0 * * *")
    public void sweep() {
        LocalDate yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1);
        log.info("Running personal streak-freeze (Shield Day) sweep for {}", yesterday);
        for (Habit habit : habitRepository.findAll()) {
            if (!habit.isArchived()) {
                evaluateHabit(habit, yesterday);
            }
        }
    }

    /** Public so it can be called directly from tests instead of waiting for the cron. */
    public void evaluateHabit(Habit habit, LocalDate dayToCheck) {
        Instant dayStart = dayToCheck.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant dayEnd = dayToCheck.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        if (checkInRepository.existsByHabitIdAndOccurredAtBetween(habit.getId(), dayStart, dayEnd)) {
            return; // actually checked in — nothing to protect
        }
        if (streakFreezeRepository.findByHabitIdAndUsedOnDate(habit.getId(), dayToCheck).isPresent()) {
            return; // already frozen (e.g. re-run of the sweep)
        }

        List<CheckIn> checkIns = checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtAsc(
                habit.getUserId(), habit.getId());
        Set<LocalDate> frozenDays = streakFreezeRepository.findByHabitId(habit.getId()).stream()
                .map(StreakFreeze::getUsedOnDate)
                .collect(Collectors.toSet());

        Instant asOfDayToCheck = dayToCheck.atStartOfDay(ZoneOffset.UTC).toInstant();
        StreakCalculator.Streaks asOfYesterday = StreakCalculator.compute(checkIns, ZoneOffset.UTC, asOfDayToCheck, frozenDays);
        if (asOfYesterday.current() == 0) {
            return; // no active streak to protect
        }

        if (shieldAwardService.getAvailable(habit.getUserId()) > 0) {
            streakFreezeRepository.save(new StreakFreeze(habit.getUserId(), habit.getId(), dayToCheck, StreakFreeze.PERSONAL_GRACE));
        }
        // else: no shield banked — the gap day stays unfrozen and the streak breaks normally.
    }
}
