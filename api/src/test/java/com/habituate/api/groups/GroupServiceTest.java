package com.habituate.api.groups;

import com.habituate.api.common.ForbiddenException;
import com.habituate.api.events.CheckInEventPublisher;
import com.habituate.api.habits.CreateHabitRequest;
import com.habituate.api.habits.HabitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
class GroupServiceTest {

    @Autowired
    private GroupService groupService;

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private HabitService habitService;

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
    private final List<Long> groupIds = new ArrayList<>();
    private final List<Long> friendshipIds = new ArrayList<>();

    @AfterEach
    void cleanup() {
        groupIds.forEach(groupId -> {
            groupStreakRepository.deleteById(groupId);
            groupMemberRepository.findByGroupId(groupId).forEach(m -> groupMemberRepository.deleteById(m.getId()));
            groupRepository.deleteById(groupId);
        });
        groupIds.clear();
        friendshipIds.forEach(friendshipRepository::deleteById);
        friendshipIds.clear();
        habitIds.forEach(id -> habitService.deleteHabit(ownerOf(id), id));
        habitIds.clear();
    }

    // Tracks which synthetic user owns which habit, since deleteHabit needs the owner's id.
    private final java.util.Map<Long, String> habitOwners = new java.util.HashMap<>();

    private String ownerOf(Long habitId) {
        return habitOwners.get(habitId);
    }

    private Long createHabit(String userId, String name) {
        Long id = habitService.createHabit(userId, new CreateHabitRequest(
                name, "General", "DAILY", 1, null, null, "BOOLEAN", null, null, null)).id();
        habitIds.add(id);
        habitOwners.put(id, userId);
        return id;
    }

    private void stubResolve() {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User " + inv.getArgument(0), null));
    }

    @Test
    void createGroup_createsGroupMembershipAndStreakRow() {
        stubResolve();
        String userId = "group-test-user-1";
        Long habitId = createHabit(userId, "Morning Walk");

        GroupResponse response = groupService.createGroup(userId, new CreateGroupRequest("Morning Crew", habitId, "ALL_MEMBERS"));
        groupIds.add(response.id());

        assertThat(response.participantCount()).isEqualTo(1);
        assertThat(response.myHabitId()).isEqualTo(habitId);
        assertThat(response.rule()).isEqualTo("all_members");
        assertThat(response.streak()).isEqualTo(0);
        assertThat(response.streakStatus()).isEqualTo("active");
    }

    @Test
    void createGroup_rejectsHabitNotOwnedByCreator() {
        stubResolve();
        String owner = "group-test-user-2a";
        String other = "group-test-user-2b";
        Long habitId = createHabit(owner, "Owner's Habit");

        assertThatThrownBy(() ->
                groupService.createGroup(other, new CreateGroupRequest("Group", habitId, "ALL_MEMBERS"))
        ).isInstanceOf(ForbiddenException.class);
    }

    @Test
    void invite_rejectsNonFriend() {
        stubResolve();
        String userId = "group-test-user-3a";
        String strangerId = "group-test-user-3b";
        Long habitId = createHabit(userId, "Habit");
        GroupResponse group = groupService.createGroup(userId, new CreateGroupRequest("Group", habitId, "ALL_MEMBERS"));
        groupIds.add(group.id());

        assertThatThrownBy(() -> groupService.invite(userId, group.id(), strangerId))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void invite_andAccept_addsSecondParticipant() {
        stubResolve();
        String userA = "group-test-user-4a";
        String userB = "group-test-user-4b";

        // Make them friends first (mocked Firebase lookup, same pattern as FriendshipServiceTest).
        when(userLookupService.findByEmail("friend4b@example.com"))
                .thenReturn(Optional.of(new UserProfile(userB, "User B", "friend4b@example.com")));
        var pending = friendshipService.sendRequest(userA, "friend4b@example.com");
        friendshipIds.add(pending.id());
        friendshipService.respond(userB, pending.id(), true);

        Long habitA = createHabit(userA, "Habit A");
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Group", habitA, "ALL_MEMBERS"));
        groupIds.add(group.id());

        groupService.invite(userA, group.id(), userB);

        List<GroupInviteResponse> invites = groupService.listPendingInvites(userB);
        assertThat(invites).anyMatch(i -> i.groupId().equals(group.id()));

        Long habitB = createHabit(userB, "Habit B");
        GroupResponse afterAccept = groupService.acceptInvite(userB, group.id(), habitB);

        assertThat(afterAccept.participantCount()).isEqualTo(2);
    }

    @Test
    void invite_rejectsAlreadyMember() {
        stubResolve();
        String userA = "group-test-user-5a";
        String userB = "group-test-user-5b";

        when(userLookupService.findByEmail("friend5b@example.com"))
                .thenReturn(Optional.of(new UserProfile(userB, "User B", "friend5b@example.com")));
        var pending = friendshipService.sendRequest(userA, "friend5b@example.com");
        friendshipIds.add(pending.id());
        friendshipService.respond(userB, pending.id(), true);

        Long habitA = createHabit(userA, "Habit A");
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Group", habitA, "ALL_MEMBERS"));
        groupIds.add(group.id());

        groupService.invite(userA, group.id(), userB);

        assertThatThrownBy(() -> groupService.invite(userA, group.id(), userB))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
