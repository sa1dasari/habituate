package com.habituate.api.groups;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

/**
 * GroupStreakConsumer only ever reacts to a check-in arriving (a positive
 * signal) — it never notices "a day closed without anyone checking in,"
 * since no event fires for that. This daily sweep is what actually closes
 * out a day: for each group whose streak didn't qualify yesterday, either
 * auto-applies a group grace freeze (if one hasn't been used in the last 30
 * days) or resets the streak. Runs just after UTC midnight so "yesterday"
 * has fully closed — same UTC-bucketing caveat as GroupStreakEngine.
 */
@Component
public class StreakFreezeScheduler {

    private static final Logger log = LoggerFactory.getLogger(StreakFreezeScheduler.class);
    private static final int FREEZE_COOLDOWN_DAYS = 30;

    private final GroupRepository groupRepository;
    private final GroupStreakRepository groupStreakRepository;
    private final StreakFreezeRepository streakFreezeRepository;

    public StreakFreezeScheduler(
            GroupRepository groupRepository,
            GroupStreakRepository groupStreakRepository,
            StreakFreezeRepository streakFreezeRepository) {
        this.groupRepository = groupRepository;
        this.groupStreakRepository = groupStreakRepository;
        this.streakFreezeRepository = streakFreezeRepository;
    }

    @Scheduled(cron = "0 5 0 * * *")
    public void sweep() {
        LocalDate yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1);
        log.info("Running streak-freeze sweep for {}", yesterday);
        for (Group group : groupRepository.findAll()) {
            evaluateGroup(group.getId(), yesterday);
        }
    }

    /** Public so it can be called directly from tests instead of waiting for the cron. */
    public void evaluateGroup(Long groupId, LocalDate dayToCheck) {
        GroupStreak streak = groupStreakRepository.findById(groupId).orElse(null);
        if (streak == null || streak.getCurrentStreak() == 0) {
            return; // nothing to protect
        }
        if (streak.getLastQualifyingDate() != null && !streak.getLastQualifyingDate().isBefore(dayToCheck)) {
            return; // already qualified on (or after) dayToCheck — nothing to close out
        }

        LocalDate cooldownCutoff = dayToCheck.minusDays(FREEZE_COOLDOWN_DAYS);
        List<StreakFreeze> recentFreezes = streakFreezeRepository.findByGroupIdAndUsedOnDateAfter(groupId, cooldownCutoff);

        if (recentFreezes.isEmpty()) {
            streakFreezeRepository.save(new StreakFreeze(groupId, dayToCheck, StreakFreeze.GROUP_GRACE));
            // Treat the frozen day as if it qualified so the chain isn't
            // broken once a real check-in resumes — only the status reads
            // as "frozen," the streak count itself doesn't reset.
            streak.setLastQualifyingDate(dayToCheck);
            streak.setStatus(GroupStreak.FROZEN);
        } else {
            streak.setCurrentStreak(0);
            streak.setStatus(GroupStreak.ACTIVE);
        }
        streak.setUpdatedAt(Instant.now());
        groupStreakRepository.save(streak);
    }
}
