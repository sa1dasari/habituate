package com.habituate.api.groups;

import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.habits.CreateHabitRequest;
import com.habituate.api.habits.HabitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Exercises the real end-to-end path this phase's exit criteria cares about:
 * two accounts sharing a habit, checking in, and the group streak updating —
 * checking in through HabitService alone, since it already recomputes the
 * group streak synchronously as part of the same check-in write.
 */
@SpringBootTest
class GroupStreakUpdaterTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private GroupService groupService;

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private GroupStreakRepository groupStreakRepository;

    @Autowired
    private FriendshipRepository friendshipRepository;

    @MockBean
    private UserLookupService userLookupService;

    private final List<Long> habitIds = new ArrayList<>();
    private final java.util.Map<Long, String> habitOwners = new java.util.HashMap<>();
    private Long groupId;
    private Long friendshipId;

    @AfterEach
    void cleanup() {
        if (groupId != null) {
            groupStreakRepository.deleteById(groupId);
            groupMemberRepository.findByGroupId(groupId).forEach(m -> groupMemberRepository.deleteById(m.getId()));
            groupRepository.deleteById(groupId);
        }
        if (friendshipId != null) {
            friendshipRepository.deleteById(friendshipId);
        }
        habitIds.forEach(id -> habitService.deleteHabit(habitOwners.get(id), id));
    }

    private Long createHabit(String userId, String name) {
        Long id = habitService.createHabit(userId, new CreateHabitRequest(
                name, "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null, null)).id();
        habitIds.add(id);
        habitOwners.put(id, userId);
        return id;
    }

    private Long createHabitWithDailyTarget(String userId, String name, int cadenceTarget) {
        Long id = habitService.createHabit(userId, new CreateHabitRequest(
                name, "General", "DAILY", cadenceTarget, null, null, "COUNT", null, null, null, null)).id();
        habitIds.add(id);
        habitOwners.put(id, userId);
        return id;
    }

    // COUNT, not BOOLEAN — lets the test log 2 check-ins the same calendar day
    // without DuplicateCheckInException, so the weekly-qualification test
    // doesn't depend on which day of the week it happens to run.
    private Long createWeeklyHabit(String userId, String name, int weeklyTarget) {
        Long id = habitService.createHabit(userId, new CreateHabitRequest(
                name, "General", "DAILY", 1, weeklyTarget, null, "COUNT", null, null, null, null)).id();
        habitIds.add(id);
        habitOwners.put(id, userId);
        return id;
    }

    private void checkInToday(String userId, Long habitId) {
        habitService.createCheckIn(userId, habitId, new CheckInRequest(Instant.now(), 1, "manual"));
    }

    @Test
    void allMembersRule_streakActivates_onlyOnceBothMembersCheckIn() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User", null, null));

        String userA = "streak-test-user-a1";
        String userB = "streak-test-user-b1";
        when(userLookupService.findByEmail("b1@example.com"))
                .thenReturn(java.util.Optional.of(new UserProfile(userB, "User B", "b1@example.com", null)));
        var pending = friendshipService.sendRequest(userA, "b1@example.com");
        friendshipId = pending.id();
        friendshipService.respond(userB, pending.id(), true);

        Long habitA = createHabit(userA, "Habit A");
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("All Members Group", habitA, "ALL_MEMBERS"));
        groupId = group.id();

        groupService.invite(userA, groupId, userB);
        Long habitB = createHabit(userB, "Habit B");
        groupService.acceptInvite(userB, groupId, habitB);

        // Only A has checked in today — ALL_MEMBERS shouldn't qualify yet.
        checkInToday(userA, habitA);

        GroupStreak afterOnlyA = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(afterOnlyA.getCurrentStreak()).isEqualTo(0);

        // Now B checks in too — ALL_MEMBERS now qualifies.
        checkInToday(userB, habitB);

        GroupStreak afterBoth = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(afterBoth.getCurrentStreak()).isEqualTo(1);
        assertThat(afterBoth.getLongestStreak()).isEqualTo(1);
        assertThat(afterBoth.getStatus()).isEqualTo(GroupStreak.ACTIVE);
    }

    @Test
    void anyMemberRule_streakActivates_assoonAsOneChecksIn() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User", null, null));

        String userA = "streak-test-user-a2";
        String userB = "streak-test-user-b2";
        when(userLookupService.findByEmail("b2@example.com"))
                .thenReturn(java.util.Optional.of(new UserProfile(userB, "User B", "b2@example.com", null)));
        var pending = friendshipService.sendRequest(userA, "b2@example.com");
        friendshipId = pending.id();
        friendshipService.respond(userB, pending.id(), true);

        Long habitA = createHabit(userA, "Habit A");
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Any Member Group", habitA, "ANY_MEMBER"));
        groupId = group.id();

        groupService.invite(userA, groupId, userB);
        Long habitB = createHabit(userB, "Habit B");
        groupService.acceptInvite(userB, groupId, habitB);

        checkInToday(userA, habitA);

        GroupStreak streak = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(streak.getCurrentStreak()).isEqualTo(1);
        assertThat(streak.getStatus()).isEqualTo(GroupStreak.ACTIVE);
    }

    @Test
    void weeklyGroup_streakUpdates_onlyOnceBothMembersHitTheirWeeklyTarget() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User", null, null));

        String userA = "streak-test-week-a1";
        String userB = "streak-test-week-b1";
        when(userLookupService.findByEmail("weekb1@example.com"))
                .thenReturn(java.util.Optional.of(new UserProfile(userB, "User B", "weekb1@example.com", null)));
        var pending = friendshipService.sendRequest(userA, "weekb1@example.com");
        friendshipId = pending.id();
        friendshipService.respond(userB, pending.id(), true);

        Long habitA = createWeeklyHabit(userA, "Habit A", 2);
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Weekly Group", habitA, "ALL_MEMBERS"));
        groupId = group.id();
        assertThat(group.cadenceType()).isEqualTo("WEEKLY");

        groupService.invite(userA, groupId, userB);
        Long habitB = createWeeklyHabit(userB, "Habit B", 2);
        groupService.acceptInvite(userB, groupId, habitB);

        // A hits their weekly target of 2; B hasn't checked in at all yet.
        checkInToday(userA, habitA);
        checkInToday(userA, habitA);
        assertThat(groupStreakRepository.findById(groupId).orElseThrow().getCurrentStreak()).isEqualTo(0);

        // B's first check-in isn't enough yet (target is 2).
        checkInToday(userB, habitB);
        assertThat(groupStreakRepository.findById(groupId).orElseThrow().getCurrentStreak()).isEqualTo(0);

        // B's second check-in this week crosses their target — now both qualify.
        checkInToday(userB, habitB);
        GroupStreak streak = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(streak.getCurrentStreak()).isEqualTo(1);
        assertThat(streak.getStatus()).isEqualTo(GroupStreak.ACTIVE);
    }

    @Test
    void acceptInvite_rejectsAMismatchedCadenceHabit() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User", null, null));

        String userA = "streak-test-mismatch-a1";
        String userB = "streak-test-mismatch-b1";
        when(userLookupService.findByEmail("mismatchb1@example.com"))
                .thenReturn(java.util.Optional.of(new UserProfile(userB, "User B", "mismatchb1@example.com", null)));
        var pending = friendshipService.sendRequest(userA, "mismatchb1@example.com");
        friendshipId = pending.id();
        friendshipService.respond(userB, pending.id(), true);

        Long habitA = createWeeklyHabit(userA, "Habit A", 3);
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Weekly Group", habitA, "ALL_MEMBERS"));
        groupId = group.id();

        groupService.invite(userA, groupId, userB);
        Long dailyHabitB = createHabit(userB, "Habit B");

        assertThatThrownBy(() -> groupService.acceptInvite(userB, groupId, dailyHabitB))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("3x/week");
    }

    @Test
    void acceptInvite_acceptsADailyGroup_regardlessOfTheJoinerHabitsDailyTarget() {
        // Regression: a DAILY group never stores its own cadenceTarget (its
        // qualification is "any check-in today", not a count), so this must
        // NOT be rejected just because the joiner's own habit has a
        // different "times per day" number than the creator's.
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User", null, null));

        String userA = "streak-test-dailytarget-a1";
        String userB = "streak-test-dailytarget-b1";
        when(userLookupService.findByEmail("dailytargetb1@example.com"))
                .thenReturn(java.util.Optional.of(new UserProfile(userB, "User B", "dailytargetb1@example.com", null)));
        var pending = friendshipService.sendRequest(userA, "dailytargetb1@example.com");
        friendshipId = pending.id();
        friendshipService.respond(userB, pending.id(), true);

        Long habitA = createHabitWithDailyTarget(userA, "Habit A", 1);
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Daily Group", habitA, "ALL_MEMBERS"));
        groupId = group.id();
        assertThat(group.cadenceType()).isEqualTo("DAILY");

        groupService.invite(userA, groupId, userB);
        Long habitB = createHabitWithDailyTarget(userB, "Habit B", 3);

        GroupResponse accepted = groupService.acceptInvite(userB, groupId, habitB);
        assertThat(accepted.myHabitId()).isEqualTo(habitB);
    }

    @Test
    void habitServiceCreateCheckIn_tagsGroupIdAutomatically_whenHabitIsGroupLinked() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User", null, null));

        String userA = "streak-test-user-a3";
        Long habitA = createHabit(userA, "Habit A");
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Solo Group", habitA, "ANY_MEMBER"));
        groupId = group.id();

        var checkIn = habitService.createCheckIn(userA, habitA, new CheckInRequest(Instant.now(), 1, "manual"));

        assertThat(checkIn.getGroupId()).isEqualTo(groupId);
    }
}
