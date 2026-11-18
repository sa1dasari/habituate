package com.habituate.api.groups;

import com.habituate.api.checkins.CheckInRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Recomputes a group's shared streak whenever a group-linked habit gets a
 * check-in — called directly from HabitService right after the check-in
 * write, in the same request.
 */
@Component
public class GroupStreakUpdater {

    private static final Logger log = LoggerFactory.getLogger(GroupStreakUpdater.class);

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupStreakRepository groupStreakRepository;
    private final CheckInRepository checkInRepository;

    public GroupStreakUpdater(
            GroupRepository groupRepository,
            GroupMemberRepository groupMemberRepository,
            GroupStreakRepository groupStreakRepository,
            CheckInRepository checkInRepository) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupStreakRepository = groupStreakRepository;
        this.checkInRepository = checkInRepository;
    }

    public void recomputeGroupStreak(Long groupId) {
        Group group = groupRepository.findById(groupId).orElse(null);
        if (group == null) {
            log.warn("Group {} not found during streak recompute — skipping", groupId);
            return;
        }
        if (Group.INDEPENDENT.equals(group.getTrackingMode())) {
            return; // no shared counter to maintain — each member's own streak is personal
        }

        List<GroupMember> activeMembers = groupMemberRepository.findByGroupIdAndStatus(groupId, GroupMember.ACTIVE);
        if (activeMembers.isEmpty()) {
            return;
        }

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        GroupCadence.Period period = group.cadencePeriod();
        LocalDate periodStart = GroupPeriod.periodStart(period, today);
        Instant periodStartInstant = periodStart.atStartOfDay(ZoneOffset.UTC).toInstant();
        // The period's own end, not "now" — a member's check-in made today still counts toward
        // an in-progress week/month even though the period hasn't closed yet.
        Instant periodEndInstant = GroupPeriod.periodEnd(period, today).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Boolean> qualifiedThisPeriod = new ArrayList<>();
        for (GroupMember member : activeMembers) {
            if (period == GroupCadence.Period.DAILY) {
                qualifiedThisPeriod.add(checkInRepository.existsByHabitIdAndOccurredAtBetween(member.getHabitId(), periodStartInstant, periodEndInstant));
            } else {
                int target = period == GroupCadence.Period.WEEKLY ? safeTarget(group.getWeeklyTarget()) : safeTarget(group.getMonthlyTarget());
                long count = checkInRepository.countByHabitIdAndOccurredAtBetween(member.getHabitId(), periodStartInstant, periodEndInstant);
                qualifiedThisPeriod.add(count >= target);
            }
        }

        boolean qualifies = GroupStreakEngine.qualifies(group.getStreakRule(), qualifiedThisPeriod);

        GroupStreak streak = groupStreakRepository.findById(groupId).orElseGet(() -> new GroupStreak(groupId));
        GroupStreakEngine.Result result = GroupStreakEngine.recompute(
                period, qualifies, streak.getCurrentStreak(), streak.getLongestStreak(), streak.getLastQualifyingDate(), periodStart);

        streak.setCurrentStreak(result.currentStreak());
        streak.setLongestStreak(result.longestStreak());
        streak.setLastQualifyingDate(result.lastQualifyingDate());
        streak.setStatus(result.status());
        streak.setUpdatedAt(Instant.now());
        groupStreakRepository.save(streak);
    }

    private int safeTarget(Integer target) {
        return target == null || target < 1 ? 1 : target;
    }
}
