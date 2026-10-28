package com.habituate.api.users;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.groups.Group;
import com.habituate.api.groups.GroupMember;
import com.habituate.api.groups.GroupMemberRepository;
import com.habituate.api.groups.GroupRepository;
import com.habituate.api.groups.GroupStreak;
import com.habituate.api.groups.GroupStreakRepository;
import com.habituate.api.groups.FriendshipService;
import com.habituate.api.groups.UserLookupService;
import com.habituate.api.groups.UserProfile;
import com.habituate.api.habits.Habit;
import com.habituate.api.habits.HabitRepository;
import com.habituate.api.habits.StreakCalculator;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Backs the tappable friend-profile viewer (tap a friend's name/avatar anywhere it appears).
 * Friendship-gated — never callable for a non-friend — and branches on the target's own
 * User.profileVisibility: PRIVATE shows only name/username/avatar plus any Shared Habit group
 * streak the viewer and target are both currently ACTIVE members of together (that streak is
 * already visible to the viewer as a groupmate, so it isn't really "their private data" from
 * the viewer's side — same reasoning as check_in_cheers' friend-activity feed, per CLAUDE.md).
 * PUBLIC additionally shows aggregate-only stats computed by adapting
 * coach.CoachContextBuilder/habits.StreakCalculator's per-habit math into a single rollup —
 * never the viewer's actual per-habit list or raw check-in history.
 */
@Service
public class FriendProfileService {

    private final FriendshipService friendshipService;
    private final UserRepository userRepository;
    private final UserLookupService userLookupService;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupRepository groupRepository;
    private final GroupStreakRepository groupStreakRepository;
    private final HabitRepository habitRepository;
    private final CheckInRepository checkInRepository;

    public FriendProfileService(
            FriendshipService friendshipService,
            UserRepository userRepository,
            UserLookupService userLookupService,
            GroupMemberRepository groupMemberRepository,
            GroupRepository groupRepository,
            GroupStreakRepository groupStreakRepository,
            HabitRepository habitRepository,
            CheckInRepository checkInRepository) {
        this.friendshipService = friendshipService;
        this.userRepository = userRepository;
        this.userLookupService = userLookupService;
        this.groupMemberRepository = groupMemberRepository;
        this.groupRepository = groupRepository;
        this.groupStreakRepository = groupStreakRepository;
        this.habitRepository = habitRepository;
        this.checkInRepository = checkInRepository;
    }

    public FriendProfileResponse getProfile(String viewerId, String targetUserId) {
        if (viewerId.equals(targetUserId)) {
            throw new IllegalArgumentException("Use GET /api/users/me to view your own profile");
        }
        if (!friendshipService.areFriends(viewerId, targetUserId)) {
            throw new ForbiddenException("Not friends with user: " + targetUserId);
        }

        UserProfile firebaseProfile = userLookupService.resolve(targetUserId);
        String username = userRepository.findById(targetUserId).map(User::getUsername).orElse(null);
        String visibility = userRepository.findById(targetUserId)
                .map(User::getProfileVisibility)
                .orElse(User.VISIBILITY_PRIVATE);

        List<FriendProfileResponse.SharedGroupStreak> sharedGroupStreaks = mutualSharedGroupStreaks(viewerId, targetUserId);

        FriendProfileResponse.PublicStats publicStats = User.VISIBILITY_PUBLIC.equals(visibility)
                ? buildPublicStats(targetUserId)
                : null;

        return new FriendProfileResponse(
                targetUserId,
                firebaseProfile.displayName(),
                username,
                firebaseProfile.photoUrl(),
                visibility,
                sharedGroupStreaks,
                publicStats);
    }

    /** Groups where both the viewer and the target are currently ACTIVE members — "currently
     * active" on both sides, not just a past/pending membership. */
    private List<FriendProfileResponse.SharedGroupStreak> mutualSharedGroupStreaks(String viewerId, String targetUserId) {
        Set<Long> viewerGroupIds = groupMemberRepository.findByUserIdAndStatus(viewerId, GroupMember.ACTIVE).stream()
                .map(GroupMember::getGroupId)
                .collect(Collectors.toCollection(HashSet::new));

        List<Long> mutualGroupIds = groupMemberRepository.findByUserIdAndStatus(targetUserId, GroupMember.ACTIVE).stream()
                .map(GroupMember::getGroupId)
                .filter(viewerGroupIds::contains)
                .distinct()
                .toList();
        if (mutualGroupIds.isEmpty()) {
            return List.of();
        }

        Map<Long, Group> groupsById = groupRepository.findAllById(mutualGroupIds).stream()
                .collect(Collectors.toMap(Group::getId, Function.identity()));

        return groupStreakRepository.findAllById(mutualGroupIds).stream()
                .map(streak -> {
                    Group group = groupsById.get(streak.getGroupId());
                    return new FriendProfileResponse.SharedGroupStreak(
                            streak.getGroupId(),
                            group != null ? group.getName() : "Shared habit",
                            streak.getCurrentStreak() == null ? 0 : streak.getCurrentStreak(),
                            streak.getLongestStreak() == null ? 0 : streak.getLongestStreak(),
                            streak.getStatus());
                })
                .sorted(Comparator.comparing(FriendProfileResponse.SharedGroupStreak::groupName))
                .toList();
    }

    /** Aggregate-only across the target's non-archived habits: best current streak, best
     * longest streak ever, and a summed 30-day consistency percentage — adapted from
     * coach.CoachContextBuilder's per-habit windowStats, just rolled into one number instead of
     * kept per habit, since a friend's actual per-habit breakdown is exactly what PUBLIC
     * visibility is NOT supposed to expose. Uses UTC day-bucketing (unlike the viewer's own
     * StreakIndicator, which buckets in the viewer's device zone) — an approximation that's
     * fine for an aggregate summary of someone else's account, same caveat already documented
     * on group streaks/insights elsewhere in this codebase. */
    private FriendProfileResponse.PublicStats buildPublicStats(String targetUserId) {
        List<Habit> habits = habitRepository.findByUserIdAndArchivedFalseOrderByCreatedAtDesc(targetUserId);

        int bestCurrent = 0;
        int bestLongest = 0;
        int completed30 = 0;
        int possible30 = 0;
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        for (Habit habit : habits) {
            List<CheckIn> checkIns = checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtDesc(targetUserId, habit.getId());
            StreakCalculator.Streaks streaks = StreakCalculator.compute(checkIns, ZoneOffset.UTC);
            bestCurrent = Math.max(bestCurrent, streaks.current());
            bestLongest = Math.max(bestLongest, streaks.longest());

            Set<LocalDate> activeDays = checkIns.stream()
                    .filter(c -> c.getValue() != null && c.getValue() > 0)
                    .map(c -> c.getOccurredAt().atZone(ZoneOffset.UTC).toLocalDate())
                    .collect(Collectors.toSet());
            LocalDate habitCreated = habit.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
            for (int i = 0; i < 30; i++) {
                LocalDate day = today.minusDays(i);
                if (day.isBefore(habitCreated)) continue;
                possible30++;
                if (activeDays.contains(day)) completed30++;
            }
        }

        double consistency = possible30 == 0 ? 0.0 : Math.round(completed30 * 1000.0 / possible30) / 10.0;
        String memberSince = resolveMemberSinceQuietly(targetUserId);

        return new FriendProfileResponse.PublicStats(habits.size(), bestCurrent, bestLongest, consistency, memberSince);
    }

    /** Firebase Auth's own account-creation timestamp — this table has no createdAt column of
     * its own (see CLAUDE.md's users data-model note). Never fails the whole profile load: a
     * lookup error just means memberSince shows as null, same spirit as
     * UserProfileService.photoUrlQuietly. */
    private String resolveMemberSinceQuietly(String uid) {
        if (FirebaseApp.getApps().isEmpty()) {
            return null;
        }
        try {
            long creationTimestampMs = FirebaseAuth.getInstance().getUser(uid).getUserMetadata().getCreationTimestamp();
            if (creationTimestampMs <= 0) return null;
            return Instant.ofEpochMilli(creationTimestampMs).atZone(ZoneOffset.UTC).toLocalDate().toString();
        } catch (Exception e) {
            return null;
        }
    }
}
