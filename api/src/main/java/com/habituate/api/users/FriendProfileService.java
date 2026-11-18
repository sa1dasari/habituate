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
import com.habituate.api.groups.GroupCadence;
import com.habituate.api.habits.Habit;
import com.habituate.api.habits.HabitRepository;
import com.habituate.api.habits.HabitTower;
import com.habituate.api.habits.HabitTowerRepository;
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
    private final HabitTowerRepository habitTowerRepository;

    /** Fallback TOWER_COLOR_PALETTE key (mobile/constants/towerColors.js) for a habit that
     * never got a custom colour — chosen server-side so a friend tower never falls back
     * through the category-keyed chain the owner's own towers use, since category is
     * deliberately withheld here (see FriendProfileResponse.FriendTower). */
    private static final String NEUTRAL_TOWER_COLOR_KEY = "slate";

    public FriendProfileService(
            FriendshipService friendshipService,
            UserRepository userRepository,
            UserLookupService userLookupService,
            GroupMemberRepository groupMemberRepository,
            GroupRepository groupRepository,
            GroupStreakRepository groupStreakRepository,
            HabitRepository habitRepository,
            CheckInRepository checkInRepository,
            HabitTowerRepository habitTowerRepository) {
        this.friendshipService = friendshipService;
        this.userRepository = userRepository;
        this.userLookupService = userLookupService;
        this.groupMemberRepository = groupMemberRepository;
        this.groupRepository = groupRepository;
        this.groupStreakRepository = groupStreakRepository;
        this.habitRepository = habitRepository;
        this.checkInRepository = checkInRepository;
        this.habitTowerRepository = habitTowerRepository;
    }

    /** Backs the Profile page's own "Hi {name}, you're doing great" hero card — the same
     * aggregate-stats shape a friend sees on your PUBLIC profile, just for yourself and
     * never gated by your own visibility setting (that setting controls what OTHERS see,
     * not what you can see about your own account). */
    public FriendProfileResponse.PublicStats getMyStats(String userId) {
        return buildPublicStats(userId);
    }

    public FriendProfileResponse getProfile(String viewerId, String targetUserId) {
        if (viewerId.equals(targetUserId)) {
            throw new IllegalArgumentException("Use GET /api/users/me to view your own profile");
        }
        if (!friendshipService.areFriends(viewerId, targetUserId)) {
            throw new ForbiddenException("Not friends with user: " + targetUserId);
        }

        UserProfile firebaseProfile = userLookupService.resolve(targetUserId);
        java.util.Optional<User> targetRow = userRepository.findById(targetUserId);
        String username = targetRow.map(User::getUsername).orElse(null);
        String visibility = targetRow
                .map(User::getProfileVisibility)
                .orElse(User.VISIBILITY_PRIVATE);

        List<FriendProfileResponse.SharedGroupStreak> sharedGroupStreaks = mutualSharedGroupStreaks(viewerId, targetUserId);

        boolean isPublic = User.VISIBILITY_PUBLIC.equals(visibility);
        FriendProfileResponse.PublicStats publicStats = isPublic ? buildPublicStats(targetUserId) : null;
        List<FriendProfileResponse.FriendTower> towers = isPublic ? buildTowers(targetUserId) : null;

        return new FriendProfileResponse(
                targetUserId,
                firebaseProfile.displayName(),
                username,
                firebaseProfile.photoUrl(),
                visibility,
                sharedGroupStreaks,
                publicStats,
                towers);
    }

    /** Groups where both the viewer and the target are currently ACTIVE members — "currently
     * active" on both sides, not just a past/pending membership. */
    private List<FriendProfileResponse.SharedGroupStreak> mutualSharedGroupStreaks(String viewerId, String targetUserId) {
        Set<Long> viewerGroupIds = groupMemberRepository.findByUserIdAndStatus(viewerId, GroupMember.ACTIVE).stream()
                .map(GroupMember::getGroupId)
                .collect(Collectors.toCollection(HashSet::new));

        List<GroupMember> targetMemberships = groupMemberRepository.findByUserIdAndStatus(targetUserId, GroupMember.ACTIVE).stream()
                .filter(m -> viewerGroupIds.contains(m.getGroupId()))
                .toList();
        if (targetMemberships.isEmpty()) {
            return List.of();
        }
        Map<Long, Long> targetHabitIdByGroupId = targetMemberships.stream()
                .collect(Collectors.toMap(GroupMember::getGroupId, GroupMember::getHabitId, (a, b) -> a));
        List<Long> mutualGroupIds = targetMemberships.stream().map(GroupMember::getGroupId).distinct().toList();

        Map<Long, Group> groupsById = groupRepository.findAllById(mutualGroupIds).stream()
                .collect(Collectors.toMap(Group::getId, Function.identity()));
        Map<Long, Habit> targetHabitsById = habitRepository.findAllById(targetHabitIdByGroupId.values()).stream()
                .collect(Collectors.toMap(Habit::getId, Function.identity()));

        return groupStreakRepository.findAllById(mutualGroupIds).stream()
                .map(streak -> {
                    Group group = groupsById.get(streak.getGroupId());
                    Habit targetHabit = targetHabitsById.get(targetHabitIdByGroupId.get(streak.getGroupId()));
                    return new FriendProfileResponse.SharedGroupStreak(
                            streak.getGroupId(),
                            group != null ? group.getName() : "Shared habit",
                            streak.getCurrentStreak() == null ? 0 : streak.getCurrentStreak(),
                            streak.getLongestStreak() == null ? 0 : streak.getLongestStreak(),
                            streak.getStatus(),
                            targetHabit == null || Group.STATUS_ONLY.equals(groupVisibilityLevel(group))
                                    ? null
                                    : buildTower(targetHabit));
                })
                .sorted(Comparator.comparing(FriendProfileResponse.SharedGroupStreak::groupName))
                .toList();
    }

    /** STATUS_ONLY groups withhold each other's exact logged amount — a tower's floorCount
     * and currentRun ARE that amount, so theirTower is suppressed entirely for those groups
     * rather than sent in some reduced shape nothing has designed yet. */
    private String groupVisibilityLevel(Group group) {
        return group == null ? Group.FULL_DETAILS : group.getVisibilityLevel();
    }

    /** Board 43's towers: every non-archived, daily-cadence habit (the same distinction
     * utils/cadence.js's hasDailyTarget makes client-side, ported server-side as
     * GroupCadence.classify — a weekly/monthly habit draws as a lot, not a tower, and friend
     * skyline Phase 6 scope is towers only). Capped at nothing — all of them are shown, same
     * as the owner's own skyline. */
    private List<FriendProfileResponse.FriendTower> buildTowers(String targetUserId) {
        return habitRepository.findByUserIdAndArchivedFalseOrderByCreatedAtDesc(targetUserId).stream()
                .filter(h -> GroupCadence.classify(h.getCadenceType(), h.getCadenceTarget(), h.getWeeklyTarget(), h.getMonthlyTarget()).period()
                        == GroupCadence.Period.DAILY)
                .map(this::buildTower)
                .toList();
    }

    /** One habit's tower: current segment's floor count (calendar days stood, same rule the
     * owner's own skyline uses — not check-in count), current run, and up to the 2 most
     * recently finished towers' own floor counts (board 43's faded-behind compositing). No
     * dates, no name — just enough to draw the silhouette. */
    private FriendProfileResponse.FriendTower buildTower(Habit habit) {
        List<CheckIn> checkIns = checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtAsc(habit.getUserId(), habit.getId());
        StreakCalculator.Streaks streaks = StreakCalculator.compute(checkIns, ZoneOffset.UTC);

        List<HabitTower> segments = habitTowerRepository.findByHabitIdOrderByStartedAtAsc(habit.getId());
        Instant openSegmentStart = segments.stream()
                .filter(s -> s.getToppedOutAt() == null)
                .map(HabitTower::getStartedAt)
                .findFirst()
                .orElse(habit.getCreatedAt());
        int floorCount = daysBetweenInclusive(openSegmentStart, Instant.now());

        List<HabitTower> closedSegments = segments.stream().filter(s -> s.getToppedOutAt() != null).toList();
        List<Integer> closedSegmentFloorCounts = closedSegments.stream()
                .skip(Math.max(0, closedSegments.size() - 2))
                .map(s -> daysBetweenInclusive(s.getStartedAt(), s.getToppedOutAt()))
                .toList();

        String color = habit.getColor() != null ? habit.getColor() : NEUTRAL_TOWER_COLOR_KEY;

        return new FriendProfileResponse.FriendTower(
                color, floorCount, streaks.current(), closedSegmentFloorCounts);
    }

    private int daysBetweenInclusive(Instant start, Instant end) {
        LocalDate startDate = start.atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate endDate = end.atZone(ZoneOffset.UTC).toLocalDate();
        return (int) java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) + 1;
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
