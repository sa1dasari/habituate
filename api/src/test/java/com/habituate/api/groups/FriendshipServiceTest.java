package com.habituate.api.groups;

import com.habituate.api.notifications.AppNotificationRepository;
import com.habituate.api.notifications.AppNotificationResponse;
import com.habituate.api.users.User;
import com.habituate.api.users.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/** UserLookupService is mocked — no real Firebase accounts needed to exercise friend-invite logic. */
@SpringBootTest
class FriendshipServiceTest {

    @Autowired
    private FriendshipService friendshipService;

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AppNotificationRepository appNotificationRepository;

    @MockBean
    private UserLookupService userLookupService;

    private final List<Long> friendshipIds = new java.util.ArrayList<>();
    private final List<String> userIds = new java.util.ArrayList<>();

    @AfterEach
    void cleanup() {
        friendshipIds.forEach(friendshipRepository::deleteById);
        friendshipIds.clear();
        userIds.forEach(id -> {
            appNotificationRepository.findTop50ByUserIdOrderByCreatedAtDesc(id)
                    .forEach(n -> appNotificationRepository.deleteById(n.getId()));
            if (userRepository.existsById(id)) {
                userRepository.deleteById(id);
            }
        });
        userIds.clear();
    }

    @Test
    void sendRequest_createsPendingFriendship() {
        when(userLookupService.findByEmail("friend@example.com"))
                .thenReturn(Optional.of(new UserProfile("friend-uid-1", "Friend One", "friend@example.com", null)));
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Someone", null, null));

        FriendshipResponse response = friendshipService.sendRequest("me-uid", "friend@example.com");
        friendshipIds.add(response.id());

        assertThat(response.otherUserId()).isEqualTo("friend-uid-1");
        assertThat(response.status()).isEqualTo(Friendship.PENDING);
    }

    @Test
    void sendRequest_rejectsUnknownEmail() {
        when(userLookupService.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> friendshipService.sendRequest("me-uid", "nobody@example.com"))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void sendRequest_rejectsSelfInvite() {
        when(userLookupService.findByEmail("me@example.com"))
                .thenReturn(Optional.of(new UserProfile("me-uid", "Me", "me@example.com", null)));

        assertThatThrownBy(() -> friendshipService.sendRequest("me-uid", "me@example.com"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sendRequest_rejectsDuplicateEitherDirection() {
        when(userLookupService.findByEmail(eq("friend@example.com")))
                .thenReturn(Optional.of(new UserProfile("friend-uid-2", "Friend Two", "friend@example.com", null)));
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Someone", null, null));

        FriendshipResponse first = friendshipService.sendRequest("me-uid", "friend@example.com");
        friendshipIds.add(first.id());

        assertThatThrownBy(() -> friendshipService.sendRequest("me-uid", "friend@example.com"))
                .isInstanceOf(com.habituate.api.common.DuplicateFriendRequestException.class);
    }

    @Test
    void respond_accept_flipsStatusAndAreFriendsBecomesTrue() {
        when(userLookupService.findByEmail("friend@example.com"))
                .thenReturn(Optional.of(new UserProfile("friend-uid-3", "Friend Three", "friend@example.com", null)));
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Someone", null, null));

        FriendshipResponse pending = friendshipService.sendRequest("me-uid", "friend@example.com");
        friendshipIds.add(pending.id());

        assertThat(friendshipService.areFriends("me-uid", "friend-uid-3")).isFalse();

        friendshipService.respond("friend-uid-3", pending.id(), true);

        assertThat(friendshipService.areFriends("me-uid", "friend-uid-3")).isTrue();
    }

    @Test
    void respond_onlyRecipientCanRespond() {
        when(userLookupService.findByEmail("friend@example.com"))
                .thenReturn(Optional.of(new UserProfile("friend-uid-4", "Friend Four", "friend@example.com", null)));
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Someone", null, null));

        FriendshipResponse pending = friendshipService.sendRequest("me-uid", "friend@example.com");
        friendshipIds.add(pending.id());

        assertThatThrownBy(() -> friendshipService.respond("me-uid", pending.id(), true))
                .isInstanceOf(com.habituate.api.common.ForbiddenException.class);
    }

    @Test
    void sendRequestByUsername_resolvesLocalUsername() {
        String target = "friend-uid-5";
        userIds.add(target);
        User targetUser = new User(target, null);
        targetUser.setUsername("findme5");
        userRepository.save(targetUser);
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Someone", null, null));

        FriendshipResponse response = friendshipService.sendRequestByUsername("me-uid-5", "FindMe5");
        friendshipIds.add(response.id());

        assertThat(response.otherUserId()).isEqualTo(target);
    }

    @Test
    void sendRequestByUsername_rejectsUnknownUsername() {
        assertThatThrownBy(() -> friendshipService.sendRequestByUsername("me-uid-6", "nobody_has_this_name"))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void respond_accept_notifiesRequester() {
        String requester = "me-uid-7";
        userIds.add(requester);
        when(userLookupService.findByEmail("friend7@example.com"))
                .thenReturn(Optional.of(new UserProfile("friend-uid-7", "Friend Seven", "friend7@example.com", null)));
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Accepter", null, null));

        FriendshipResponse pending = friendshipService.sendRequest(requester, "friend7@example.com");
        friendshipIds.add(pending.id());

        friendshipService.respond("friend-uid-7", pending.id(), true);

        List<AppNotificationResponse> notifications = appNotificationRepository.findTop50ByUserIdOrderByCreatedAtDesc(requester)
                .stream().map(n -> new AppNotificationResponse(n.getId(), n.getType(), n.getTitle(), n.getBody(),
                        n.getGroupId(), n.getChallengeId(), n.getHabitId(), n.getPeriodStart(), n.isRead(), n.getCreatedAt()))
                .toList();
        assertThat(notifications).anyMatch(n -> n.type().equals("FRIEND_REQUEST_ACCEPTED"));
    }
}
