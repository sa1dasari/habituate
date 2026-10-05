package com.habituate.api.groups;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.habits.Habit;
import com.habituate.api.habits.HabitRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class GroupActivityService {

    private final CheckInRepository checkInRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final HabitRepository habitRepository;
    private final CheckInCheerRepository checkInCheerRepository;
    private final UserLookupService userLookupService;

    public GroupActivityService(
            CheckInRepository checkInRepository,
            GroupMemberRepository groupMemberRepository,
            HabitRepository habitRepository,
            CheckInCheerRepository checkInCheerRepository,
            UserLookupService userLookupService) {
        this.checkInRepository = checkInRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.habitRepository = habitRepository;
        this.checkInCheerRepository = checkInCheerRepository;
        this.userLookupService = userLookupService;
    }

    /** Recent check-ins from the viewer's own groupmates — never their own, never a non-groupmate's. */
    public List<GroupActivityItem> recentActivity(String viewingUserId) {
        List<Long> groupIds = groupMemberRepository.findByUserIdAndStatus(viewingUserId, GroupMember.ACTIVE).stream()
                .map(GroupMember::getGroupId)
                .toList();
        if (groupIds.isEmpty()) {
            return List.of();
        }

        List<CheckIn> checkIns = checkInRepository
                .findTop20ByGroupIdInAndUserIdNotOrderByOccurredAtDesc(groupIds, viewingUserId);
        if (checkIns.isEmpty()) {
            return List.of();
        }

        Map<Long, Habit> habitsById = habitRepository
                .findAllById(checkIns.stream().map(CheckIn::getHabitId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(Habit::getId, Function.identity()));

        List<Long> checkInIds = checkIns.stream().map(CheckIn::getId).toList();
        Map<Long, List<CheckInCheer>> cheersByCheckInId = checkInCheerRepository.findByCheckInIdIn(checkInIds).stream()
                .collect(Collectors.groupingBy(CheckInCheer::getCheckInId));

        return checkIns.stream()
                .map(checkIn -> {
                    Habit habit = habitsById.get(checkIn.getHabitId());
                    List<CheckInCheer> cheers = cheersByCheckInId.getOrDefault(checkIn.getId(), List.of());
                    return new GroupActivityItem(
                            checkIn.getId(),
                            checkIn.getUserId(),
                            userLookupService.resolve(checkIn.getUserId()).displayName(),
                            habit != null ? habit.getName() : "a habit",
                            checkIn.getOccurredAt(),
                            cheers.size(),
                            cheers.stream().anyMatch(c -> c.getUserId().equals(viewingUserId)));
                })
                .toList();
    }

    @Transactional
    public void cheer(String userId, Long checkInId) {
        requireVisible(userId, checkInId);
        if (checkInCheerRepository.findByCheckInIdAndUserId(checkInId, userId).isPresent()) {
            return; // already cheered — idempotent
        }
        checkInCheerRepository.save(new CheckInCheer(checkInId, userId));
    }

    @Transactional
    public void uncheer(String userId, Long checkInId) {
        checkInCheerRepository.findByCheckInIdAndUserId(checkInId, userId)
                .ifPresent(checkInCheerRepository::delete);
    }

    /** Only a fellow active member of the check-in's group may cheer it — never an arbitrary check-in id. */
    private void requireVisible(String userId, Long checkInId) {
        CheckIn checkIn = checkInRepository.findById(checkInId)
                .orElseThrow(() -> new EntityNotFoundException("Check-in not found: " + checkInId));
        boolean isActiveGroupmate = checkIn.getGroupId() != null
                && groupMemberRepository.findByGroupIdAndUserId(checkIn.getGroupId(), userId)
                        .map(member -> GroupMember.ACTIVE.equals(member.getStatus()))
                        .orElse(false);
        if (!isActiveGroupmate) {
            throw new ForbiddenException("Not visible to user: " + userId);
        }
    }
}
