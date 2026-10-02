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

        scheduler.evaluateGroup(groupId, dayToCheck);

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

        scheduler.evaluateGroup(groupId, dayToCheck);

        GroupStreak result = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(result.getStatus()).isEqualTo(GroupStreak.ACTIVE);
        assertThat(result.getCurrentStreak()).isEqualTo(0);
    }

    @Test
    void doesNothing_whenStreakAlreadyQualifiedThatDay() {
        LocalDate dayToCheck = LocalDate.of(2026, 2, 1);
        groupId = newGroupWithStreak(5, dayToCheck); // already qualified today

        scheduler.evaluateGroup(groupId, dayToCheck);

        GroupStreak result = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(result.getStatus()).isEqualTo(GroupStreak.ACTIVE);
        assertThat(result.getCurrentStreak()).isEqualTo(5);
    }

    @Test
    void doesNothing_whenNoActiveStreakToProtect() {
        LocalDate dayToCheck = LocalDate.of(2026, 2, 1);
        groupId = newGroupWithStreak(0, null);

        scheduler.evaluateGroup(groupId, dayToCheck);

        GroupStreak result = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(result.getCurrentStreak()).isEqualTo(0);
        assertThat(result.getStatus()).isEqualTo(GroupStreak.ACTIVE);
    }
}
