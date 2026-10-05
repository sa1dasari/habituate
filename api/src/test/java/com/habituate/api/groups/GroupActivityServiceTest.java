package com.habituate.api.groups;

import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.events.CheckInEventPublisher;
import com.habituate.api.habits.CreateHabitRequest;
import com.habituate.api.habits.HabitService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
class GroupActivityServiceTest {

    @Autowired
    private HabitService habitService;

    @Autowired
    private GroupService groupService;

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private GroupActivityService groupActivityService;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private GroupStreakRepository groupStreakRepository;

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Autowired
    private CheckInCheerRepository checkInCheerRepository;

    @MockBean
    private CheckInEventPublisher checkInEventPublisher;

    @MockBean
    private UserLookupService userLookupService;

    private final List<Long> habitIds = new ArrayList<>();
    private final Map<Long, String> habitOwners = new HashMap<>();
    private Long groupId;
    private Long friendshipId;

    @AfterEach
    void cleanup() {
        if (groupId != null) {
            groupStreakRepository.findById(groupId).ifPresent(s -> groupStreakRepository.deleteById(groupId));
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

    private Long setUpGroupOfTwo(String userA, String userB, String emailB) {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Name " + inv.getArgument(0), null));
        when(userLookupService.findByEmail(emailB)).thenReturn(Optional.of(new UserProfile(userB, "User B", emailB)));

        var pending = friendshipService.sendRequest(userA, emailB);
        friendshipId = pending.id();
        friendshipService.respond(userB, pending.id(), true);

        Long habitA = createHabit(userA, "Habit A");
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Group", habitA, "ANY_MEMBER"));
        groupId = group.id();

        groupService.invite(userA, groupId, userB);
        Long habitB = createHabit(userB, "Habit B");
        groupService.acceptInvite(userB, groupId, habitB);
        return habitA;
    }

    @Test
    void recentActivity_showsGroupmatesCheckIn_notViewersOwn() {
        String userA = "activity-test-user-a1";
        String userB = "activity-test-user-b1";
        Long habitA = setUpGroupOfTwo(userA, userB, "activity-b1@example.com");

        habitService.createCheckIn(userA, habitA, new CheckInRequest(Instant.now(), 1, "manual"));

        List<GroupActivityItem> feedForB = groupActivityService.recentActivity(userB);
        assertThat(feedForB).hasSize(1);
        assertThat(feedForB.get(0).userId()).isEqualTo(userA);
        assertThat(feedForB.get(0).habitName()).isEqualTo("Habit A");
        assertThat(feedForB.get(0).cheerCount()).isEqualTo(0);
        assertThat(feedForB.get(0).cheeredByMe()).isFalse();

        List<GroupActivityItem> feedForA = groupActivityService.recentActivity(userA);
        assertThat(feedForA).isEmpty(); // only A's own check-in exists so far — never shows your own
    }

    @Test
    void cheer_thenUncheer_updatesCountAndCheeredByMe() {
        String userA = "activity-test-user-a2";
        String userB = "activity-test-user-b2";
        Long habitA = setUpGroupOfTwo(userA, userB, "activity-b2@example.com");

        var checkIn = habitService.createCheckIn(userA, habitA, new CheckInRequest(Instant.now(), 1, "manual"));

        groupActivityService.cheer(userB, checkIn.getId());
        List<GroupActivityItem> feed = groupActivityService.recentActivity(userB);
        assertThat(feed.get(0).cheerCount()).isEqualTo(1);
        assertThat(feed.get(0).cheeredByMe()).isTrue();

        groupActivityService.uncheer(userB, checkIn.getId());
        feed = groupActivityService.recentActivity(userB);
        assertThat(feed.get(0).cheerCount()).isEqualTo(0);
        assertThat(feed.get(0).cheeredByMe()).isFalse();

        checkInCheerRepository.findByCheckInIdAndUserId(checkIn.getId(), userB)
                .ifPresent(c -> checkInCheerRepository.deleteById(c.getId()));
    }

    @Test
    void cheer_rejectsNonGroupmate() {
        String userA = "activity-test-user-a3";
        String userB = "activity-test-user-b3";
        Long habitA = setUpGroupOfTwo(userA, userB, "activity-b3@example.com");

        var checkIn = habitService.createCheckIn(userA, habitA, new CheckInRequest(Instant.now(), 1, "manual"));

        assertThatThrownBy(() -> groupActivityService.cheer("activity-test-stranger", checkIn.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void recentActivity_emptyForUserInNoGroups() {
        assertThat(groupActivityService.recentActivity("activity-test-lone-user")).isEmpty();
    }
}
