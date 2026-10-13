package com.habituate.api.users;

import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.coach.CoachMessage;
import com.habituate.api.coach.CoachMessageRepository;
import com.habituate.api.feedback.Feedback;
import com.habituate.api.feedback.FeedbackRepository;
import com.habituate.api.goals.Goal;
import com.habituate.api.goals.GoalRepository;
import com.habituate.api.groups.Challenge;
import com.habituate.api.groups.ChallengeCheckIn;
import com.habituate.api.groups.ChallengeCheckInRepository;
import com.habituate.api.groups.ChallengeParticipant;
import com.habituate.api.groups.ChallengeParticipantRepository;
import com.habituate.api.groups.ChallengeRepository;
import com.habituate.api.groups.CheckInCheer;
import com.habituate.api.groups.CheckInCheerRepository;
import com.habituate.api.groups.Friendship;
import com.habituate.api.groups.FriendshipRepository;
import com.habituate.api.groups.Group;
import com.habituate.api.groups.GroupMember;
import com.habituate.api.groups.GroupMemberRepository;
import com.habituate.api.groups.GroupRepository;
import com.habituate.api.habits.Habit;
import com.habituate.api.habits.HabitRepository;
import com.habituate.api.notifications.PushToken;
import com.habituate.api.notifications.PushTokenRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the account-deletion cascade (UserProfileService.deleteAccount) end
 * to end — every table the deleted user owns, plus the deliberate tradeoff
 * that deleting the sole creator of a shared group/challenge deletes it
 * entirely for every other member/participant too.
 */
@SpringBootTest
class UserProfileServiceDeleteAccountTest {

    @Autowired private UserProfileService userProfileService;
    @Autowired private UserRepository userRepository;
    @Autowired private HabitRepository habitRepository;
    @Autowired private CheckInRepository checkInRepository;
    @Autowired private CheckInCheerRepository checkInCheerRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private CoachMessageRepository coachMessageRepository;
    @Autowired private PushTokenRepository pushTokenRepository;
    @Autowired private FeedbackRepository feedbackRepository;
    @Autowired private FriendshipRepository friendshipRepository;
    @Autowired private GroupRepository groupRepository;
    @Autowired private GroupMemberRepository groupMemberRepository;
    @Autowired private ChallengeRepository challengeRepository;
    @Autowired private ChallengeParticipantRepository challengeParticipantRepository;
    @Autowired private ChallengeCheckInRepository challengeCheckInRepository;

    private String userA;
    private String userB;
    private Long groupCreatedByB;
    private Long challengeCreatedByB;

    // Deletes one by one via each repository's base deleteById (transactional
    // on its own, unlike a bare derived deleteByX called outside a
    // @Transactional service method) rather than the new bulk deleteByUserId
    // methods under test — keeps cleanup's own correctness independent of the
    // code being tested.
    @AfterEach
    void cleanup() {
        if (userA != null) userRepository.deleteById(userA);
        if (userB != null) {
            habitRepository.findByUserIdOrderByCreatedAtDesc(userB)
                    .forEach(h -> habitRepository.deleteById(h.getId()));
            groupMemberRepository.findByUserIdAndStatus(userB, GroupMember.ACTIVE)
                    .forEach(gm -> groupMemberRepository.deleteById(gm.getId()));
            if (groupCreatedByB != null) groupRepository.deleteById(groupCreatedByB);
            challengeParticipantRepository.findByUserId(userB)
                    .forEach(cp -> challengeParticipantRepository.deleteById(cp.getId()));
            if (challengeCreatedByB != null) challengeRepository.deleteById(challengeCreatedByB);
            userRepository.deleteById(userB);
        }
    }

    @Test
    void deleteAccount_removesEverythingOwnedByTheUser_andLeavesOtherUsersGroupsIntact() {
        userA = "delete-test-user-a";
        userB = "delete-test-user-b";
        userRepository.save(new User(userA, "America/New_York"));
        userRepository.save(new User(userB, "America/New_York"));

        Habit habitA = habitRepository.save(new Habit(userA, "Read", "learning", "daily", 1));
        CheckIn checkInA = checkInRepository.save(new CheckIn(habitA.getId(), userA, Instant.now(), 1, "manual"));
        checkInCheerRepository.save(new CheckInCheer(checkInA.getId(), userB)); // B cheered A's check-in
        Habit habitB = habitRepository.save(new Habit(userB, "Walk", "fitness", "daily", 1));
        CheckIn checkInB = checkInRepository.save(new CheckIn(habitB.getId(), userB, Instant.now(), 1, "manual"));
        checkInCheerRepository.save(new CheckInCheer(checkInB.getId(), userA)); // A cheered B's check-in

        goalRepository.save(new Goal(userA, "Save $500", "MONTHLY", 500, LocalDate.now().withDayOfMonth(1)));
        coachMessageRepository.save(new CoachMessage(userA, "USER", "How am I doing?"));
        pushTokenRepository.save(new PushToken(userA, "ExponentPushToken[test-a]", "ios"));
        feedbackRepository.save(new Feedback(userA, Feedback.BUG, "Habits", "Something broke", null, null, "1.0.0", "ios"));
        friendshipRepository.save(new Friendship(userA, userB));

        // Group A created — B is a member — deleting A must delete the whole group.
        Group groupByA = groupRepository.save(new Group("A's group", userA, Group.ALL_MEMBERS));
        groupMemberRepository.save(new GroupMember(groupByA.getId(), userA, habitA.getId(), GroupMember.ACTIVE));
        groupMemberRepository.save(new GroupMember(groupByA.getId(), userB, habitB.getId(), GroupMember.ACTIVE));

        // Group B created — A is a member — deleting A must only remove A's membership.
        Group groupByB = groupRepository.save(new Group("B's group", userB, Group.ALL_MEMBERS));
        groupCreatedByB = groupByB.getId();
        groupMemberRepository.save(new GroupMember(groupByB.getId(), userB, habitB.getId(), GroupMember.ACTIVE));
        groupMemberRepository.save(new GroupMember(groupByB.getId(), userA, habitA.getId(), GroupMember.ACTIVE));

        // Challenge A created — B joined — deleting A must delete the whole challenge.
        Challenge challengeByA = challengeRepository.save(
                new Challenge("A's challenge", "desc", userA, 10, LocalDate.now(), LocalDate.now().plusDays(30), Challenge.PRIVATE));
        challengeParticipantRepository.save(new ChallengeParticipant(challengeByA.getId(), userA));
        challengeParticipantRepository.save(new ChallengeParticipant(challengeByA.getId(), userB));
        challengeCheckInRepository.save(new ChallengeCheckIn(challengeByA.getId(), userA, Instant.now()));
        challengeCheckInRepository.save(new ChallengeCheckIn(challengeByA.getId(), userB, Instant.now()));

        // Challenge B created — A joined — deleting A must only remove A's participation.
        Challenge challengeByB = challengeRepository.save(
                new Challenge("B's challenge", "desc", userB, 10, LocalDate.now(), LocalDate.now().plusDays(30), Challenge.PRIVATE));
        challengeCreatedByB = challengeByB.getId();
        challengeParticipantRepository.save(new ChallengeParticipant(challengeByB.getId(), userB));
        challengeParticipantRepository.save(new ChallengeParticipant(challengeByB.getId(), userA));
        challengeCheckInRepository.save(new ChallengeCheckIn(challengeByB.getId(), userA, Instant.now()));

        userProfileService.deleteAccount(userA);

        // Everything A owned is gone.
        assertThat(userRepository.findById(userA)).isEmpty();
        assertThat(habitRepository.findByUserIdOrderByCreatedAtDesc(userA)).isEmpty();
        assertThat(checkInRepository.findByUserId(userA)).isEmpty();
        assertThat(checkInCheerRepository.findByCheckInIdIn(java.util.List.of(checkInA.getId(), checkInB.getId())))
                .extracting(CheckInCheer::getUserId)
                .doesNotContain(userA);
        assertThat(goalRepository.findByUserIdAndArchivedFalseOrderByCreatedAtDesc(userA)).isEmpty();
        assertThat(coachMessageRepository.findByUserIdOrderByCreatedAtAsc(userA)).isEmpty();
        assertThat(pushTokenRepository.findByUserId(userA)).isEmpty();
        assertThat(feedbackRepository.findByUserIdOrderByCreatedAtDesc(userA)).isEmpty();
        assertThat(friendshipRepository.findByRequesterIdAndRecipientId(userA, userB)).isEmpty();

        // The group A created is gone entirely, including B's membership in it.
        assertThat(groupRepository.findById(groupByA.getId())).isEmpty();
        assertThat(groupMemberRepository.findByGroupId(groupByA.getId())).isEmpty();

        // The group B created survives — only A's membership was removed.
        assertThat(groupRepository.findById(groupByB.getId())).isPresent();
        assertThat(groupMemberRepository.findByGroupIdAndUserId(groupByB.getId(), userB)).isPresent();
        assertThat(groupMemberRepository.findByGroupIdAndUserId(groupByB.getId(), userA)).isEmpty();

        // The challenge A created is gone entirely, including B's participation in it.
        assertThat(challengeRepository.findById(challengeByA.getId())).isEmpty();
        assertThat(challengeParticipantRepository.findByChallengeId(challengeByA.getId())).isEmpty();

        // The challenge B created survives — only A's participation was removed.
        assertThat(challengeRepository.findById(challengeByB.getId())).isPresent();
        assertThat(challengeParticipantRepository.findByChallengeIdAndUserId(challengeByB.getId(), userB)).isPresent();
        assertThat(challengeParticipantRepository.findByChallengeIdAndUserId(challengeByB.getId(), userA)).isEmpty();

        // B's own data (untouched by A's deletion) is still there.
        assertThat(userRepository.findById(userB)).isPresent();
        assertThat(habitRepository.findByUserIdOrderByCreatedAtDesc(userB)).hasSize(1);
    }
}
