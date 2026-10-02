package com.habituate.api.groups;

import com.habituate.api.common.ForbiddenException;
import com.habituate.api.habits.Habit;
import com.habituate.api.habits.HabitRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupStreakRepository groupStreakRepository;
    private final FriendshipService friendshipService;
    private final HabitRepository habitRepository;
    private final UserLookupService userLookupService;

    public GroupService(
            GroupRepository groupRepository,
            GroupMemberRepository groupMemberRepository,
            GroupStreakRepository groupStreakRepository,
            FriendshipService friendshipService,
            HabitRepository habitRepository,
            UserLookupService userLookupService) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupStreakRepository = groupStreakRepository;
        this.friendshipService = friendshipService;
        this.habitRepository = habitRepository;
        this.userLookupService = userLookupService;
    }

    @Transactional
    public GroupResponse createGroup(String userId, CreateGroupRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Group name is required");
        }
        requireOwnedHabit(userId, request.habitId());

        String streakRule = normalizeStreakRule(request.streakRule());

        Group group = groupRepository.save(new Group(name, userId, streakRule));
        groupMemberRepository.save(new GroupMember(group.getId(), userId, request.habitId(), GroupMember.ACTIVE));
        groupStreakRepository.save(new GroupStreak(group.getId()));

        return toResponse(group, userId);
    }

    @Transactional
    public void invite(String userId, Long groupId, String friendUserId) {
        requireActiveMember(userId, groupId);

        if (!friendshipService.areFriends(userId, friendUserId)) {
            throw new ForbiddenException("Can only invite accepted friends to a group");
        }

        if (groupMemberRepository.findByGroupIdAndUserId(groupId, friendUserId).isPresent()) {
            throw new IllegalArgumentException("User is already invited or a member of this group");
        }

        groupMemberRepository.save(new GroupMember(groupId, friendUserId, null, GroupMember.PENDING));
    }

    @Transactional
    public GroupResponse acceptInvite(String userId, Long groupId, Long habitId) {
        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new EntityNotFoundException("No invite found for this group"));

        if (!GroupMember.PENDING.equals(member.getStatus())) {
            throw new IllegalArgumentException("This invite was already responded to");
        }

        requireOwnedHabit(userId, habitId);

        member.setHabitId(habitId);
        member.setStatus(GroupMember.ACTIVE);
        groupMemberRepository.save(member);

        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new EntityNotFoundException("Group not found: " + groupId));
        return toResponse(group, userId);
    }

    public List<GroupResponse> listMyGroups(String userId) {
        return groupMemberRepository.findByUserIdAndStatus(userId, GroupMember.ACTIVE).stream()
                .map(GroupMember::getGroupId)
                .distinct()
                .map(groupId -> groupRepository.findById(groupId).orElse(null))
                .filter(g -> g != null)
                .map(group -> toResponse(group, userId))
                .toList();
    }

    public List<GroupInviteResponse> listPendingInvites(String userId) {
        return groupMemberRepository.findByUserIdAndStatus(userId, GroupMember.PENDING).stream()
                .map(member -> {
                    Group group = groupRepository.findById(member.getGroupId()).orElse(null);
                    if (group == null) return null;
                    return new GroupInviteResponse(
                            group.getId(), group.getName(), userLookupService.resolve(group.getCreatedBy()).displayName(),
                            group.getStreakRule().toLowerCase());
                })
                .filter(r -> r != null)
                .toList();
    }

    private void requireActiveMember(String userId, Long groupId) {
        GroupMember member = groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Group not found: " + groupId));
        if (!GroupMember.ACTIVE.equals(member.getStatus())) {
            throw new ForbiddenException("Not an active member of this group");
        }
    }

    private Habit requireOwnedHabit(String userId, Long habitId) {
        if (habitId == null) {
            throw new IllegalArgumentException("habitId is required");
        }
        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new EntityNotFoundException("Habit not found: " + habitId));
        if (!userId.equals(habit.getUserId())) {
            throw new ForbiddenException("Habit does not belong to user: " + userId);
        }
        return habit;
    }

    private String normalizeStreakRule(String value) {
        if (value == null || value.isBlank()) {
            return Group.ALL_MEMBERS;
        }
        String upper = value.trim().toUpperCase();
        if (upper.equals(Group.ALL_MEMBERS) || upper.equals(Group.ANY_MEMBER)) {
            return upper;
        }
        throw new IllegalArgumentException("Invalid streakRule, expected ALL_MEMBERS or ANY_MEMBER: " + value);
    }

    private GroupResponse toResponse(Group group, String viewingUserId) {
        List<GroupMember> activeMembers = groupMemberRepository.findByGroupIdAndStatus(group.getId(), GroupMember.ACTIVE);

        List<GroupResponse.Participant> participants = activeMembers.stream()
                .map(m -> new GroupResponse.Participant(userLookupService.resolve(m.getUserId()).displayName()))
                .toList();

        Optional<Long> myHabitId = activeMembers.stream()
                .filter(m -> m.getUserId().equals(viewingUserId))
                .map(GroupMember::getHabitId)
                .findFirst();

        GroupStreak streak = groupStreakRepository.findById(group.getId())
                .orElseGet(() -> new GroupStreak(group.getId()));

        return new GroupResponse(
                group.getId(),
                group.getName(),
                participants,
                activeMembers.size(),
                streak.getCurrentStreak(),
                streak.getLongestStreak(),
                streak.getStatus(),
                group.getStreakRule().toLowerCase(),
                myHabitId.orElse(null)
        );
    }
}
