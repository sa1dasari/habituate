package com.habituate.api.habits;

import com.habituate.api.billing.EntitlementService;
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
 *
 * The bank cap is entitlement-aware (owner decision 2026-11-24, SKYLINE.md
 * section 14 #21): the free tier's "2 Shield Days" limit is this same bank
 * capped lower, not a separate lifetime-used counter — a lifetime-unlock
 * user gets no cap at all ("Unlimited Shield Days", board 87), rather than
 * the previous flat 3-for-everyone.
 */
@Service
public class ShieldAwardService {

    public static final int MILESTONE_INTERVAL = 7;

    private final ShieldAwardRepository shieldAwardRepository;
    private final StreakFreezeRepository streakFreezeRepository;
    private final EntitlementService entitlementService;

    public ShieldAwardService(
            ShieldAwardRepository shieldAwardRepository,
            StreakFreezeRepository streakFreezeRepository,
            EntitlementService entitlementService) {
        this.shieldAwardRepository = shieldAwardRepository;
        this.streakFreezeRepository = streakFreezeRepository;
        this.entitlementService = entitlementService;
    }

    public int getAvailable(String userId) {
        long earned = shieldAwardRepository.countByUserId(userId);
        long spent = streakFreezeRepository.countByUserIdAndHabitIdIsNotNull(userId);
        return (int) Math.max(0, earned - spent);
    }

    private int maxBanked(String userId) {
        return entitlementService.isEntitled(userId)
                ? Integer.MAX_VALUE
                : EntitlementService.FREE_SHIELD_BANK_LIMIT;
    }

    /** Awards one Shield the first time a habit's current streak crosses a multiple of 7, capped. */
    @Transactional
    public void awardIfEligible(String userId, Long habitId, int currentStreak) {
        if (currentStreak <= 0 || currentStreak % MILESTONE_INTERVAL != 0) {
            return;
        }
        if (getAvailable(userId) >= maxBanked(userId)) {
            return;
        }
        if (shieldAwardRepository.existsByUserIdAndHabitIdAndStreakLength(userId, habitId, currentStreak)) {
            return;
        }
        shieldAwardRepository.save(new ShieldAward(userId, habitId, currentStreak));
    }
}
