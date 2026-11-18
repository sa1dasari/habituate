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
 * GroupStreakUpdater only ever reacts to a check-in arriving (a positive
 * signal) — it never notices "a period closed without anyone qualifying,"
 * since no event fires for that. This daily sweep is what actually closes
 * out a period: for each group whose streak didn't qualify for its last
 * closed period, either auto-applies a group grace freeze (if one hasn't
 * been used in the last 30 days) or resets the streak. Runs just after UTC
 * midnight so "yesterday" has fully closed — same UTC-bucketing caveat as
 * GroupStreakEngine.
 *
 * Period-aware (SKYLINE.md #15): a DAILY group's period is literally
 * yesterday, so every group is still evaluated every day, unchanged. A
 * WEEKLY/MONTHLY group's period has usually NOT just closed on a given
 * day — evaluateGroup only actually runs for one when `yesterday` was the
 * last day of its own period (a Sunday for WEEKLY, the month's last day
 * for MONTHLY); other days are a no-op for it, same as GroupStreakUpdater
 * not advancing it mid-period.
 */
@Component
public class StreakFreezeScheduler {

    private static final Logger log = LoggerFactory.getLogger(StreakFreezeScheduler.class);
    private static final int FREEZE_WINDOW_DAYS = 30;

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
            if (Group.INDEPENDENT.equals(group.getTrackingMode())) {
                continue; // no shared counter to protect
            }
            GroupCadence.Period period = group.cadencePeriod();
            if (!GroupPeriod.periodEnd(period, yesterday).equals(yesterday)) {
                continue; // this group's current period hasn't closed yet — nothing to evaluate
            }
            LocalDate periodToCheck = GroupPeriod.periodStart(period, yesterday);
            evaluateGroup(group.getId(), group.getSkipDaysPerMonth(), period, periodToCheck);
        }
    }

    /** Public so it can be called directly from tests instead of waiting for the cron.
     * @param skipDaysPerMonth how many group-grace freezes this group allows in a rolling
     *                         30-day window (the "Missed Day Rules" setting) before the streak resets.
     * @param periodToCheck the START of the just-closed period (a plain day for DAILY). */
    public void evaluateGroup(Long groupId, int skipDaysPerMonth, GroupCadence.Period period, LocalDate periodToCheck) {
        GroupStreak streak = groupStreakRepository.findById(groupId).orElse(null);
        if (streak == null || streak.getCurrentStreak() == 0) {
            return; // nothing to protect
        }
        if (streak.getLastQualifyingDate() != null && !streak.getLastQualifyingDate().isBefore(periodToCheck)) {
            return; // already qualified for (or after) periodToCheck — nothing to close out
        }

        LocalDate windowCutoff = periodToCheck.minusDays(FREEZE_WINDOW_DAYS);
        List<StreakFreeze> recentFreezes = streakFreezeRepository.findByGroupIdAndUsedOnDateAfter(groupId, windowCutoff);

        if (recentFreezes.size() < skipDaysPerMonth) {
            streakFreezeRepository.save(new StreakFreeze(groupId, periodToCheck, StreakFreeze.GROUP_GRACE));
            // Treat the frozen period as if it qualified so the chain isn't
            // broken once real qualification resumes — only the status reads
            // as "frozen," the streak count itself doesn't reset.
            streak.setLastQualifyingDate(periodToCheck);
            streak.setStatus(GroupStreak.FROZEN);
        } else {
            streak.setCurrentStreak(0);
            streak.setStatus(GroupStreak.ACTIVE);
        }
        streak.setUpdatedAt(Instant.now());
        groupStreakRepository.save(streak);
    }
}
