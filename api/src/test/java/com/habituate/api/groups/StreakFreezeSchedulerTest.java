package com.habituate.api.groups;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class StreakFreezeSchedulerTest {

    @Autowired
    private StreakFreezeScheduler scheduler;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private GroupStreakRepository groupStreakRepository;

    @Autowired
    private StreakFreezeRepository streakFreezeRepository;

    private Long groupId;

    @AfterEach
    void cleanup() {
        if (groupId != null) {
            streakFreezeRepository.findAll().stream()
                    .filter(f -> groupId.equals(f.getGroupId()))
                    .forEach(f -> streakFreezeRepository.deleteById(f.getId()));
            groupStreakRepository.deleteById(groupId);
            groupRepository.deleteById(groupId);
        }
    }

    private Long newGroupWithStreak(int currentStreak, LocalDate lastQualifyingDate) {
        Group group = groupRepository.save(new Group("Test Group", "scheduler-test-user", Group.ALL_MEMBERS));
        GroupStreak streak = new GroupStreak(group.getId());
        streak.setCurrentStreak(currentStreak);
        streak.setLongestStreak(currentStreak);
        streak.setLastQualifyingDate(lastQualifyingDate);
        streak.setStatus(GroupStreak.ACTIVE);
        groupStreakRepository.save(streak);
        return group.getId();
    }

    @Test
    void appliesFreeze_whenStreakBrokenAndNoFreezeUsedRecently() {
        LocalDate dayToCheck = LocalDate.of(2026, 2, 1);
        LocalDate lastQualified = dayToCheck.minusDays(1); // qualified the day before, missed dayToCheck
        groupId = newGroupWithStreak(5, lastQualified);

        scheduler.evaluateGroup(groupId, 1, GroupCadence.Period.DAILY, dayToCheck);

        GroupStreak result = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(result.getStatus()).isEqualTo(GroupStreak.FROZEN);
        assertThat(result.getCurrentStreak()).isEqualTo(5); // not reset
        assertThat(result.getLastQualifyingDate()).isEqualTo(dayToCheck); // treated as if it qualified

        List<StreakFreeze> freezes = streakFreezeRepository.findByGroupIdAndUsedOnDateAfter(groupId, dayToCheck.minusDays(31));
        assertThat(freezes).hasSize(1);
    }

    @Test
    void resetsStreak_whenFreezeAlreadyUsedWithinCooldown() {
        LocalDate dayToCheck = LocalDate.of(2026, 2, 1);
        LocalDate lastQualified = dayToCheck.minusDays(1);
        groupId = newGroupWithStreak(5, lastQualified);
        streakFreezeRepository.save(new StreakFreeze(groupId, dayToCheck.minusDays(10), StreakFreeze.GROUP_GRACE));

        scheduler.evaluateGroup(groupId, 1, GroupCadence.Period.DAILY, dayToCheck);

        GroupStreak result = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(result.getStatus()).isEqualTo(GroupStreak.ACTIVE);
        assertThat(result.getCurrentStreak()).isEqualTo(0);
    }

    @Test
    void doesNothing_whenStreakAlreadyQualifiedThatDay() {
        LocalDate dayToCheck = LocalDate.of(2026, 2, 1);
        groupId = newGroupWithStreak(5, dayToCheck); // already qualified today

        scheduler.evaluateGroup(groupId, 1, GroupCadence.Period.DAILY, dayToCheck);

        GroupStreak result = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(result.getStatus()).isEqualTo(GroupStreak.ACTIVE);
        assertThat(result.getCurrentStreak()).isEqualTo(5);
    }

    @Test
    void doesNothing_whenNoActiveStreakToProtect() {
        LocalDate dayToCheck = LocalDate.of(2026, 2, 1);
        groupId = newGroupWithStreak(0, null);

        scheduler.evaluateGroup(groupId, 1, GroupCadence.Period.DAILY, dayToCheck);

        GroupStreak result = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(result.getCurrentStreak()).isEqualTo(0);
        assertThat(result.getStatus()).isEqualTo(GroupStreak.ACTIVE);
    }

    @Test
    void appliesFreeze_whenUnderConfiguredSkipDaysLimit() {
        LocalDate dayToCheck = LocalDate.of(2026, 2, 1);
        LocalDate lastQualified = dayToCheck.minusDays(1);
        groupId = newGroupWithStreak(5, lastQualified);
        // One freeze already used this window — still under a 3-skip-day allowance.
        streakFreezeRepository.save(new StreakFreeze(groupId, dayToCheck.minusDays(10), StreakFreeze.GROUP_GRACE));

        scheduler.evaluateGroup(groupId, 3, GroupCadence.Period.DAILY, dayToCheck);

        GroupStreak result = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(result.getStatus()).isEqualTo(GroupStreak.FROZEN);
        assertThat(result.getCurrentStreak()).isEqualTo(5);
    }

    @Test
    void resetsStreak_whenConfiguredSkipDaysLimitExhausted() {
        LocalDate dayToCheck = LocalDate.of(2026, 2, 1);
        LocalDate lastQualified = dayToCheck.minusDays(1);
        groupId = newGroupWithStreak(5, lastQualified);
        streakFreezeRepository.save(new StreakFreeze(groupId, dayToCheck.minusDays(5), StreakFreeze.GROUP_GRACE));
        streakFreezeRepository.save(new StreakFreeze(groupId, dayToCheck.minusDays(10), StreakFreeze.GROUP_GRACE));
        streakFreezeRepository.save(new StreakFreeze(groupId, dayToCheck.minusDays(15), StreakFreeze.GROUP_GRACE));

        scheduler.evaluateGroup(groupId, 3, GroupCadence.Period.DAILY, dayToCheck);

        GroupStreak result = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(result.getStatus()).isEqualTo(GroupStreak.ACTIVE);
        assertThat(result.getCurrentStreak()).isEqualTo(0);
    }

    // Period-native freeze budget (owner decision 2026-11-18): skipDaysPerMonth=1 for a
    // WEEKLY/MONTHLY group means "never two frozen periods in a row" — the window is the
    // last `skipDaysPerMonth` periods themselves, not a day count.

    @Test
    void weekly_freezesOncePerBudget_thenResetsOnTheNextMissedWeekInARow() {
        LocalDate thisWeek = LocalDate.of(2026, 11, 16); // a Monday
        LocalDate lastWeek = thisWeek.minusWeeks(1);
        groupId = newGroupWithStreak(4, lastWeek);

        // First missed week, budget 1: freezes.
        scheduler.evaluateGroup(groupId, 1, GroupCadence.Period.WEEKLY, thisWeek);
        GroupStreak afterFirst = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(afterFirst.getStatus()).isEqualTo(GroupStreak.FROZEN);
        assertThat(afterFirst.getCurrentStreak()).isEqualTo(4);

        // The very next week also missed, same budget of 1: resets — two frozen weeks in a row
        // isn't allowed.
        LocalDate nextWeek = thisWeek.plusWeeks(1);
        scheduler.evaluateGroup(groupId, 1, GroupCadence.Period.WEEKLY, nextWeek);
        GroupStreak afterSecond = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(afterSecond.getStatus()).isEqualTo(GroupStreak.ACTIVE);
        assertThat(afterSecond.getCurrentStreak()).isEqualTo(0);
    }

    @Test
    void monthly_higherBudget_toleratesTwoFrozenMonthsInARow() {
        LocalDate february = LocalDate.of(2026, 2, 1); // the short month on purpose
        LocalDate january = february.minusMonths(1);
        groupId = newGroupWithStreak(6, january);

        scheduler.evaluateGroup(groupId, 2, GroupCadence.Period.MONTHLY, february);
        assertThat(groupStreakRepository.findById(groupId).orElseThrow().getStatus()).isEqualTo(GroupStreak.FROZEN);

        LocalDate march = february.plusMonths(1);
        scheduler.evaluateGroup(groupId, 2, GroupCadence.Period.MONTHLY, march);
        GroupStreak result = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(result.getStatus()).isEqualTo(GroupStreak.FROZEN); // still within budget of 2
        assertThat(result.getCurrentStreak()).isEqualTo(6);
    }
}
