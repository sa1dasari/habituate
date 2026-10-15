package com.habituate.api.groups;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.habits.Habit;
import com.habituate.api.habits.HabitRepository;
import com.habituate.api.habits.StreakCalculator;
import com.habituate.api.notifications.AppNotification;
import com.habituate.api.notifications.AppNotificationService;
import com.habituate.api.notifications.ExpoPushMessage;
import com.habituate.api.notifications.ExpoPushService;
import com.habituate.api.notifications.PushToken;
import com.habituate.api.notifications.PushTokenRepository;
import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupStreakRepository groupStreakRepository;
    private final FriendshipService friendshipService;
    private final HabitRepository habitRepository;
    private final UserLookupService userLookupService;
    private final CheckInRepository checkInRepository;
    private final UserRepository userRepository;
    private final PushTokenRepository pushTokenRepository;
    private final ExpoPushService expoPushService;
    private final AppNotificationService appNotificationService;

    public GroupService(
            GroupRepository groupRepository,
            GroupMemberRepository groupMemberRepository,
            GroupStreakRepository groupStreakRepository,
            FriendshipService friendshipService,
            HabitRepository habitRepository,
            UserLookupService userLookupService,
            CheckInRepository checkInRepository,
            UserRepository userRepository,
            PushTokenRepository pushTokenRepository,
            ExpoPushService expoPushService,
            AppNotificationService appNotificationService) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupStreakRepository = groupStreakRepository;
        this.friendshipService = friendshipService;
        this.habitRepository = habitRepository;
        this.userLookupService = userLookupService;
        this.checkInRepository = checkInRepository;
        this.userRepository = userRepository;
        this.pushTokenRepository = pushTokenRepository;
        this.expoPushService = expoPushService;
        this.appNotificationService = appNotificationService;
    }

    @Transactional
    public GroupResponse createGroup(String userId, CreateGroupRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Group name is required");
        }
        requireOwnedHabit(userId, request.habitId());

        String streakRule = normalizeStreakRule(request.streakRule());
        String goalAlignment = normalizeOneOf(request.goalAlignment(), Group.UNIFIED, Group.UNIFIED, Group.SPLIT);
        String trackingMode = normalizeOneOf(request.trackingMode(), Group.COOPERATIVE, Group.COOPERATIVE, Group.INDEPENDENT);
        String visibilityLevel = normalizeOneOf(request.visibilityLevel(), Group.FULL_DETAILS, Group.FULL_DETAILS, Group.STATUS_ONLY);
        boolean nudgesEnabled = request.nudgesEnabled() == null || request.nudgesEnabled();
        int skipDaysPerMonth = request.skipDaysPerMonth() == null ? 1 : Math.max(0, Math.min(3, request.skipDaysPerMonth()));

        Group group = groupRepository.save(new Group(
                name, userId, streakRule, goalAlignment, trackingMode, visibilityLevel, nudgesEnabled, skipDaysPerMonth));
        groupMemberRepository.save(new GroupMember(group.getId(), userId, request.habitId(), GroupMember.ACTIVE));
        groupStreakRepository.save(new GroupStreak(group.getId()));

        return toResponse(group, userId);
    }

    /** Only the group's creator may edit its settings — no co-admin concept yet, same
     * single-owner model Challenge/Habit already use. habitId/streakRule's effect on the
     * *shared* counter and goalAlignment/trackingMode can all be changed after creation;
     * switching trackingMode between COOPERATIVE and INDEPENDENT is allowed since neither
     * stores derived state that the other mode would corrupt (the shared counter just stops
     * being read/written, it isn't deleted). */
    @Transactional
    public GroupResponse updateGroup(String userId, Long groupId, CreateGroupRequest request) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new EntityNotFoundException("Group not found: " + groupId));
        if (!userId.equals(group.getCreatedBy())) {
            throw new ForbiddenException("Only the creator can edit this shared habit");
        }

        String name = request.name() == null ? "" : request.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("Group name is required");
        }

        group.setName(name);
        group.setStreakRule(normalizeStreakRule(request.streakRule()));
        group.setGoalAlignment(normalizeOneOf(request.goalAlignment(), Group.UNIFIED, Group.UNIFIED, Group.SPLIT));
        group.setTrackingMode(normalizeOneOf(request.trackingMode(), Group.COOPERATIVE, Group.COOPERATIVE, Group.INDEPENDENT));
        group.setVisibilityLevel(normalizeOneOf(request.visibilityLevel(), Group.FULL_DETAILS, Group.FULL_DETAILS, Group.STATUS_ONLY));
        group.setNudgesEnabled(request.nudgesEnabled() == null || request.nudgesEnabled());
        group.setSkipDaysPerMonth(request.skipDaysPerMonth() == null ? 1 : Math.max(0, Math.min(3, request.skipDaysPerMonth())));
        groupRepository.save(group);

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

        String joinerName = userLookupService.resolve(userId).displayName();
        List<String> otherMemberIds = groupMemberRepository.findByGroupIdAndStatus(groupId, GroupMember.ACTIVE).stream()
                .map(GroupMember::getUserId)
                .filter(id -> !id.equals(userId))
                .toList();
        appNotificationService.notifyAll(otherMemberIds, AppNotification.GROUP_JOINED,
                "New member joined", joinerName + " joined \"" + group.getName() + "\"", groupId, null, null);

        return toResponse(group, userId);
    }

    /** "Nudge" permission: any active member may push a reminder to another active member,
     * only when the group's creator left nudges enabled at creation time. */
    public void nudge(String userId, Long groupId, String targetUserId) {
        if (userId.equals(targetUserId)) {
            throw new IllegalArgumentException("Can't nudge yourself");
        }
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new EntityNotFoundException("Group not found: " + groupId));
        if (!group.isNudgesEnabled()) {
            throw new ForbiddenException("Nudges are turned off for this group");
        }
        requireActiveMember(userId, groupId);
        requireActiveMember(targetUserId, groupId);

        String nudgerName = userLookupService.resolve(userId).displayName();
        String title = "A nudge from " + nudgerName;
        String body = "Don't forget your habit in \"" + group.getName() + "\" today!";

        List<PushToken> tokens = pushTokenRepository.findByUserId(targetUserId);
        if (!tokens.isEmpty()) {
            List<ExpoPushMessage> messages = tokens.stream()
                    .map(token -> new ExpoPushMessage(token.getToken(), title, body, Map.of("groupId", groupId)))
                    .toList();
            expoPushService.send(messages);
        }

        appNotificationService.notify(targetUserId, AppNotification.NUDGE, title, body, groupId, null, null);
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

    private String normalizeOneOf(String value, String fallback, String optionA, String optionB) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        String upper = value.trim().toUpperCase();
        if (upper.equals(optionA) || upper.equals(optionB)) {
            return upper;
        }
        throw new IllegalArgumentException("Invalid value, expected " + optionA + " or " + optionB + ": " + value);
    }

    private ZoneId resolveZone(String userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getTimezone() == null) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(user.getTimezone());
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }

    private GroupResponse toResponse(Group group, String viewingUserId) {
        List<GroupMember> activeMembers = groupMemberRepository.findByGroupIdAndStatus(group.getId(), GroupMember.ACTIVE);
        boolean independent = Group.INDEPENDENT.equals(group.getTrackingMode());

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        Instant dayStart = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<GroupResponse.Participant> participants = activeMembers.stream()
                .map(m -> {
                    String displayName = userLookupService.resolve(m.getUserId()).displayName();
                    boolean checkedInToday = m.getHabitId() != null
                            && checkInRepository.existsByHabitIdAndOccurredAtBetween(m.getHabitId(), dayStart, dayEnd);
                    if (!independent || m.getHabitId() == null) {
                        return new GroupResponse.Participant(displayName, m.getUserId(), null, checkedInToday);
                    }
                    List<CheckIn> checkIns =
                            checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtAsc(m.getUserId(), m.getHabitId());
                    int currentStreak = StreakCalculator.compute(checkIns, resolveZone(m.getUserId())).current();
                    return new GroupResponse.Participant(displayName, m.getUserId(), currentStreak, checkedInToday);
                })
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
                independent ? 0 : streak.getCurrentStreak(),
                independent ? 0 : streak.getLongestStreak(),
                independent ? GroupStreak.ACTIVE : streak.getStatus(),
                group.getStreakRule().toLowerCase(),
                myHabitId.orElse(null),
                group.getGoalAlignment(),
                group.getTrackingMode(),
                group.getVisibilityLevel(),
                group.isNudgesEnabled(),
                group.getSkipDaysPerMonth(),
                viewingUserId.equals(group.getCreatedBy())
        );
    }
}
