package com.habituate.api.groups;

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

    @MockBean
    private UserLookupService userLookupService;

    private final List<Long> friendshipIds = new java.util.ArrayList<>();

    @AfterEach
    void cleanup() {
        friendshipIds.forEach(friendshipRepository::deleteById);
        friendshipIds.clear();
    }

    @Test
    void sendRequest_createsPendingFriendship() {
        when(userLookupService.findByEmail("friend@example.com"))
                .thenReturn(Optional.of(new UserProfile("friend-uid-1", "Friend One", "friend@example.com")));
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Someone", null));

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
                .thenReturn(Optional.of(new UserProfile("me-uid", "Me", "me@example.com")));

        assertThatThrownBy(() -> friendshipService.sendRequest("me-uid", "me@example.com"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sendRequest_rejectsDuplicateEitherDirection() {
        when(userLookupService.findByEmail(eq("friend@example.com")))
                .thenReturn(Optional.of(new UserProfile("friend-uid-2", "Friend Two", "friend@example.com")));
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Someone", null));

        FriendshipResponse first = friendshipService.sendRequest("me-uid", "friend@example.com");
        friendshipIds.add(first.id());

        assertThatThrownBy(() -> friendshipService.sendRequest("me-uid", "friend@example.com"))
                .isInstanceOf(com.habituate.api.common.DuplicateFriendRequestException.class);
    }

    @Test
    void respond_accept_flipsStatusAndAreFriendsBecomesTrue() {
        when(userLookupService.findByEmail("friend@example.com"))
                .thenReturn(Optional.of(new UserProfile("friend-uid-3", "Friend Three", "friend@example.com")));
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Someone", null));

        FriendshipResponse pending = friendshipService.sendRequest("me-uid", "friend@example.com");
        friendshipIds.add(pending.id());

        assertThat(friendshipService.areFriends("me-uid", "friend-uid-3")).isFalse();

        friendshipService.respond("friend-uid-3", pending.id(), true);

        assertThat(friendshipService.areFriends("me-uid", "friend-uid-3")).isTrue();
    }

    @Test
    void respond_onlyRecipientCanRespond() {
        when(userLookupService.findByEmail("friend@example.com"))
                .thenReturn(Optional.of(new UserProfile("friend-uid-4", "Friend Four", "friend@example.com")));
        when(userLookupService.resolve(any())).thenAnswer(inv -> new UserProfile(inv.getArgument(0), "Someone", null));

        FriendshipResponse pending = friendshipService.sendRequest("me-uid", "friend@example.com");
        friendshipIds.add(pending.id());

        assertThatThrownBy(() -> friendshipService.respond("me-uid", pending.id(), true))
                .isInstanceOf(com.habituate.api.common.ForbiddenException.class);
    }
}
