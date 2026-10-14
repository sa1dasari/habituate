package com.habituate.api.habits;

import com.habituate.api.groups.StreakFreezeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shield Days: a habit's streak crossing a multiple of 7 earns one Shield,
 * banked up to a cap. PersonalStreakFreezeScheduler spends one automatically
 * if a daily habit's streak would otherwise break — this keeps the earning
 * meaningful (not an unlimited safety net) while still landing the freeze
 * before the user ever sees a punitive state, per this app's anti-guilt
 * conventions. "Available" is derived (awards minus personal freezes already
 * spent), not a separately mutated counter, so there's one source of truth.
 */
@Service
public class ShieldAwardService {

    public static final int MILESTONE_INTERVAL = 7;
    public static final int MAX_BANKED = 3;

    private final ShieldAwardRepository shieldAwardRepository;
    private final StreakFreezeRepository streakFreezeRepository;

    public ShieldAwardService(ShieldAwardRepository shieldAwardRepository, StreakFreezeRepository streakFreezeRepository) {
        this.shieldAwardRepository = shieldAwardRepository;
        this.streakFreezeRepository = streakFreezeRepository;
    }

    public int getAvailable(String userId) {
        long earned = shieldAwardRepository.countByUserId(userId);
        long spent = streakFreezeRepository.countByUserIdAndHabitIdIsNotNull(userId);
        return (int) Math.max(0, earned - spent);
    }

    /** Awards one Shield the first time a habit's current streak crosses a multiple of 7, capped. */
    @Transactional
    public void awardIfEligible(String userId, Long habitId, int currentStreak) {
        if (currentStreak <= 0 || currentStreak % MILESTONE_INTERVAL != 0) {
            return;
        }
        if (getAvailable(userId) >= MAX_BANKED) {
            return;
        }
        if (shieldAwardRepository.existsByUserIdAndHabitIdAndStreakLength(userId, habitId, currentStreak)) {
            return;
        }
        shieldAwardRepository.save(new ShieldAward(userId, habitId, currentStreak));
    }
}
