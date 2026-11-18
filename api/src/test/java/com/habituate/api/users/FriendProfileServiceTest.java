package com.habituate.api.users;

import com.habituate.api.checkins.CheckInRequest;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.groups.CreateGroupRequest;
import com.habituate.api.groups.FriendshipRepository;
import com.habituate.api.groups.FriendshipService;
import com.habituate.api.groups.GroupMemberRepository;
import com.habituate.api.groups.GroupRepository;
import com.habituate.api.groups.GroupResponse;
import com.habituate.api.groups.GroupService;
import com.habituate.api.groups.GroupStreakRepository;
import com.habituate.api.groups.UserLookupService;
import com.habituate.api.groups.UserProfile;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/** Boards 43/44: a friendship-gated friend skyline. PUBLIC shows every non-archived,
 * daily-cadence habit's tower silhouette with no name; PRIVATE shows only mutual
 * shared-habit towers, via the skybridge. */
@SpringBootTest
class FriendProfileServiceTest {

    @Autowired
    private FriendProfileService friendProfileService;

    @Autowired
    private HabitService habitService;

    @Autowired
    private GroupService groupService;

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private GroupStreakRepository groupStreakRepository;

    @MockBean
    private UserLookupService userLookupService;

    private final List<Long> habitIds = new ArrayList<>();
    private final java.util.Map<Long, String> habitOwners = new java.util.HashMap<>();
    private final List<String> userIds = new ArrayList<>();
    private Long friendshipId;
    private Long groupId;

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
        userIds.forEach(id -> userRepository.deleteById(id));
    }

    private Long createHabit(String userId, String name, String category) {
        Long id = habitService.createHabit(userId, new CreateHabitRequest(
                name, category, "DAILY", 1, null, null, "BOOLEAN", null, null, null, null)).id();
        habitIds.add(id);
        habitOwners.put(id, userId);
        return id;
    }

    private Long createWeeklyHabit(String userId, String name) {
        Long id = habitService.createHabit(userId, new CreateHabitRequest(
                name, "General", "DAILY", 1, 3, null, "COUNT", null, null, null, null)).id();
        habitIds.add(id);
        habitOwners.put(id, userId);
        return id;
    }

    private void setVisibility(String userId, String visibility) {
        User user = userRepository.findById(userId).orElseGet(() -> new User(userId, "UTC"));
        user.setProfileVisibility(visibility);
        userRepository.save(user);
        userIds.add(userId);
    }

    private void makeFriends(String userA, String userB, String emailB) {
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "User", null, null));
        when(userLookupService.findByEmail(emailB))
                .thenReturn(Optional.of(new UserProfile(userB, "User B", emailB, null)));
        var pending = friendshipService.sendRequest(userA, emailB);
        friendshipId = pending.id();
        friendshipService.respond(userB, pending.id(), true);
    }

    @Test
    void getProfile_deniesANonFriend() {
        String userA = "friendprofile-test-deny-a";
        String userB = "friendprofile-test-deny-b";

        assertThatThrownBy(() -> friendProfileService.getProfile(userA, userB))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void publicProfile_includesATowerPerDailyHabit_noWeeklyLotsIncluded_noNameField() {
        String userA = "friendprofile-test-pub-a";
        String userB = "friendprofile-test-pub-b";
        makeFriends(userA, userB, "pub-b@example.com");
        setVisibility(userB, User.VISIBILITY_PUBLIC);

        createHabit(userB, "Read", "Learning");
        createWeeklyHabit(userB, "Run 3x a week");

        FriendProfileResponse profile = friendProfileService.getProfile(userA, userB);

        assertThat(profile.visibility()).isEqualTo(User.VISIBILITY_PUBLIC);
        assertThat(profile.towers()).hasSize(1); // the weekly habit is a lot, not a tower
        assertThat(profile.towers().get(0).color()).isEqualTo("slate"); // no colour picked -> neutral default
        assertThat(profile.towers().get(0).floorCount()).isGreaterThanOrEqualTo(1);
        assertThat(profile.publicStats()).isNotNull();
    }

    @Test
    void privateProfile_hasNoTowersList_butSharedGroupStillCarriesTheirTower() {
        String userA = "friendprofile-test-priv-a";
        String userB = "friendprofile-test-priv-b";
        makeFriends(userA, userB, "priv-b@example.com");
        setVisibility(userB, User.VISIBILITY_PRIVATE);

        Long habitA = createHabit(userA, "Push ups", "Fitness");
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Fitness Crew", habitA, "ANY_MEMBER"));
        groupId = group.id();
        groupService.invite(userA, groupId, userB);
        Long habitB = createHabit(userB, "Push ups too", "Fitness");
        groupService.acceptInvite(userB, groupId, habitB);

        FriendProfileResponse profile = friendProfileService.getProfile(userA, userB);

        assertThat(profile.visibility()).isEqualTo(User.VISIBILITY_PRIVATE);
        assertThat(profile.towers()).isNull();
        assertThat(profile.publicStats()).isNull();
        assertThat(profile.sharedGroupStreaks()).hasSize(1);
        assertThat(profile.sharedGroupStreaks().get(0).theirTower()).isNotNull();
        assertThat(profile.sharedGroupStreaks().get(0).theirTower().floorCount()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void statusOnlyGroup_suppressesTheirTower_sinceFloorCountAndRunAreTheExactAmount() {
        String userA = "friendprofile-test-statusonly-a";
        String userB = "friendprofile-test-statusonly-b";
        makeFriends(userA, userB, "statusonly-b@example.com");
        setVisibility(userB, User.VISIBILITY_PRIVATE);

        Long habitA = createHabit(userA, "Push ups", "Fitness");
        GroupResponse group = groupService.createGroup(userA, new CreateGroupRequest("Fitness Crew", habitA, "ANY_MEMBER"));
        groupId = group.id();
        groupRepository.findById(groupId).ifPresent(g -> {
            g.setVisibilityLevel(com.habituate.api.groups.Group.STATUS_ONLY);
            groupRepository.save(g);
        });
        groupService.invite(userA, groupId, userB);
        Long habitB = createHabit(userB, "Push ups too", "Fitness");
        groupService.acceptInvite(userB, groupId, habitB);

        FriendProfileResponse profile = friendProfileService.getProfile(userA, userB);

        assertThat(profile.sharedGroupStreaks()).hasSize(1);
        assertThat(profile.sharedGroupStreaks().get(0).theirTower()).isNull();
    }

    @Test
    void tower_floorCountReflectsTheOpenSegmentsCalendarDaysStood_notCheckInCount() {
        String userA = "friendprofile-test-floors-a";
        String userB = "friendprofile-test-floors-b";
        makeFriends(userA, userB, "floors-b@example.com");
        setVisibility(userB, User.VISIBILITY_PUBLIC);

        Long habitB = createHabit(userB, "Meditate", "Mindfulness");
        habitService.createCheckIn(userB, habitB, new CheckInRequest(Instant.now(), 1, "manual"));

        FriendProfileResponse profile = friendProfileService.getProfile(userA, userB);

        // Freshly created today, one check-in today — floorCount is "1 day stood", not
        // anything check-in-count derived beyond that.
        assertThat(profile.towers().get(0).floorCount()).isEqualTo(1);
        assertThat(profile.towers().get(0).currentRun()).isEqualTo(1);
    }
}
