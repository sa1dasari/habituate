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
        Instant dayStart = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Boolean> completedToday = new ArrayList<>();
        for (GroupMember member : activeMembers) {
            completedToday.add(checkInRepository.existsByHabitIdAndOccurredAtBetween(member.getHabitId(), dayStart, dayEnd));
        }

        boolean qualifies = GroupStreakEngine.qualifies(group.getStreakRule(), completedToday);

        GroupStreak streak = groupStreakRepository.findById(groupId).orElseGet(() -> new GroupStreak(groupId));
        GroupStreakEngine.Result result = GroupStreakEngine.recompute(
                qualifies, streak.getCurrentStreak(), streak.getLongestStreak(), streak.getLastQualifyingDate(), today);

        streak.setCurrentStreak(result.currentStreak());
        streak.setLongestStreak(result.longestStreak());
        streak.setLastQualifyingDate(result.lastQualifyingDate());
        streak.setStatus(result.status());
        streak.setUpdatedAt(Instant.now());
        groupStreakRepository.save(streak);
    }
}
