package com.habituate.api.groups;

import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.events.CheckInEventPublisher;
import com.habituate.api.habits.CreateHabitRequest;
import com.habituate.api.habits.HabitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Exercises the real end-to-end path this phase's exit criteria cares about:
 * two accounts sharing a habit, checking in, and the group streak updating —
 * calling GroupStreakConsumer.recomputeGroupStreak directly (what
 * HabitService.createCheckIn tagging + the real Kafka listener would trigger
 * in production) rather than going through the actual broker, so the test
 * is deterministic instead of racing an async consumer thread.
 */
@SpringBootTest
class GroupStreakConsumerTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private GroupService groupService;

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private GroupStreakConsumer groupStreakConsumer;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private GroupStreakRepository groupStreakRepository;

    @Autowired
    private FriendshipRepository friendshipRepository;

    @MockBean
    private CheckInEventPublisher checkInEventPublisher;

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
                name, "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null)).id();
        habitIds.add(id);
        habitOwners.put(id, userId);
        return id;
    }

    private void checkInToday(String userId, Long habitId) {
        habitService.createCheckIn(userId, habitId, new CheckInRequest(Instant.now(), 1, "manual"));
    }

    @Test
    void allMembersRule_streakActivates_onlyOnceBothMembersCheckIn() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User", null));

        String userA = "streak-test-user-a1";
        String userB = "streak-test-user-b1";
        when(userLookupService.findByEmail("b1@example.com"))
                .thenReturn(java.util.Optional.of(new UserProfile(userB, "User B", "b1@example.com")));
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
        groupStreakConsumer.recomputeGroupStreak(groupId);

        GroupStreak afterOnlyA = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(afterOnlyA.getCurrentStreak()).isEqualTo(0);

        // Now B checks in too — ALL_MEMBERS now qualifies.
        checkInToday(userB, habitB);
        groupStreakConsumer.recomputeGroupStreak(groupId);

        GroupStreak afterBoth = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(afterBoth.getCurrentStreak()).isEqualTo(1);
        assertThat(afterBoth.getLongestStreak()).isEqualTo(1);
        assertThat(afterBoth.getStatus()).isEqualTo(GroupStreak.ACTIVE);
    }

    @Test
    void anyMemberRule_streakActivates_assoonAsOneChecksIn() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User", null));

        String userA = "streak-test-user-a2";
        String userB = "streak-test-user-b2";
        when(userLookupService.findByEmail("b2@example.com"))
                .thenReturn(java.util.Optional.of(new UserProfile(userB, "User B", "b2@example.com")));
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
        groupStreakConsumer.recomputeGroupStreak(groupId);

        GroupStreak streak = groupStreakRepository.findById(groupId).orElseThrow();
        assertThat(streak.getCurrentStreak()).isEqualTo(1);
        assertThat(streak.getStatus()).isEqualTo(GroupStreak.ACTIVE);
    }

    @Test
    void habitServiceCreateCheckIn_tagsGroupIdAutomatically_whenHabitIsGroupLinked() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User", null));

        String userA = "streak-test-user-a3";
        Long habitA = createHabit(userA, "Habit A");
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Solo Group", habitA, "ANY_MEMBER"));
        groupId = group.id();

        var checkIn = habitService.createCheckIn(userA, habitA, new CheckInRequest(Instant.now(), 1, "manual"));

        assertThat(checkIn.getGroupId()).isEqualTo(groupId);
    }
}
