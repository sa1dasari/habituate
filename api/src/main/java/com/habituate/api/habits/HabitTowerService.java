package com.habituate.api.habits;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.groups.StreakFreeze;
import com.habituate.api.groups.StreakFreezeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Owns the `habit_towers` segment lifecycle (SKYLINE.md section 6) —
 * separate from HabitService so this stays small and independently
 * testable, the same "pure logic separate from Spring" split as
 * StreakCalculator. HabitService validates ownership and top-out
 * eligibility (daily-cadence only, age threshold) before delegating here;
 * this class doesn't re-check either — it trusts its caller, same
 * convention as StreakCalculator trusting its caller's check-in list.
 */
@Service
public class HabitTowerService {

    private final HabitTowerRepository habitTowerRepository;
    private final CheckInRepository checkInRepository;
    private final StreakFreezeRepository streakFreezeRepository;

    public HabitTowerService(
            HabitTowerRepository habitTowerRepository,
            CheckInRepository checkInRepository,
            StreakFreezeRepository streakFreezeRepository) {
        this.habitTowerRepository = habitTowerRepository;
        this.checkInRepository = checkInRepository;
        this.streakFreezeRepository = streakFreezeRepository;
    }

    /** The current open segment for this habit, lazily creating one
     * (started_at = habit.createdAt) if none exists yet — there's no batch
     * backfill migration for habits created before this table existed. */
    @Transactional
    public HabitTower currentSegment(Habit habit) {
        return habitTowerRepository.findByHabitIdAndToppedOutAtIsNull(habit.getId())
                .orElseGet(() -> habitTowerRepository.save(
                        new HabitTower(habit.getId(), habit.getUserId(), habit.getCreatedAt())));
    }

    public List<HabitTower> listSegments(Long habitId) {
        return habitTowerRepository.findByHabitIdOrderByStartedAtAsc(habitId);
    }

    /** Closes the current open segment — stamping toppedOutAt and freezing
     * its best run — and opens a fresh one starting now. Doesn't touch
     * check-ins, shields, or group membership, and never resets the run
     * itself (CLAUDE.md: "Topping out never resets the run"). */
    @Transactional
    public HabitTower topOut(Habit habit, ZoneId zone) {
        HabitTower open = currentSegment(habit);
        Instant now = Instant.now();

        List<CheckIn> checkIns = checkInRepository
                .findByUserIdAndHabitIdOrderByOccurredAtAsc(habit.getUserId(), habit.getId());
        List<CheckIn> inSegment = checkIns.stream()
                .filter(c -> !c.getOccurredAt().isBefore(open.getStartedAt()))
                .toList();
        Set<LocalDate> frozenDaysInSegment = streakFreezeRepository.findByHabitId(habit.getId()).stream()
                .map(StreakFreeze::getUsedOnDate)
                .filter(date -> !date.isBefore(open.getStartedAt().atZone(zone).toLocalDate()))
                .collect(Collectors.toSet());
        int bestRun = StreakCalculator.compute(inSegment, zone, now, frozenDaysInSegment).longest();

        open.setToppedOutAt(now);
        open.setBestRunInSegment(bestRun);
        habitTowerRepository.save(open);

        return habitTowerRepository.save(new HabitTower(habit.getId(), habit.getUserId(), now));
    }
}
