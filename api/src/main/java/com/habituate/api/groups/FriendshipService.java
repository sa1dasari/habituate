package com.habituate.api.groups;

import com.habituate.api.common.DuplicateFriendRequestException;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.notifications.AppNotification;
import com.habituate.api.notifications.AppNotificationService;
import com.habituate.api.users.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * No local users table is used for *identity resolution* elsewhere in this
 * codebase (userId is just a raw Firebase UID, resolved via UserLookupService
 * / Firebase Admin SDK) — but a username is purely local data (Firebase Auth
 * has no concept of it), so sendRequestByUsername is the one path here that
 * reads from users.UserRepository directly instead.
 */
@Service
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final UserLookupService userLookupService;
    private final UserRepository userRepository;
    private final AppNotificationService appNotificationService;

    public FriendshipService(
            FriendshipRepository friendshipRepository,
            UserLookupService userLookupService,
            UserRepository userRepository,
            AppNotificationService appNotificationService) {
        this.friendshipRepository = friendshipRepository;
        this.userLookupService = userLookupService;
        this.userRepository = userRepository;
        this.appNotificationService = appNotificationService;
    }

    @Transactional
    public FriendshipResponse sendRequest(String userId, String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("email is required");
        }

        UserProfile target = userLookupService.findByEmail(email.trim())
                .orElseThrow(() -> new EntityNotFoundException("No account found for email: " + email));

        return createRequest(userId, target.uid());
    }

    @Transactional
    public FriendshipResponse sendRequestByUsername(String userId, String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("username is required");
        }

        var target = userRepository.findByUsernameIgnoreCase(username.trim())
                .orElseThrow(() -> new EntityNotFoundException("No account found for username: " + username));

        return createRequest(userId, target.getId());
    }

    private FriendshipResponse createRequest(String userId, String targetUserId) {
        if (targetUserId.equals(userId)) {
            throw new IllegalArgumentException("Cannot send a friend request to yourself");
        }

        boolean alreadyExists = friendshipRepository.findByRequesterIdAndRecipientId(userId, targetUserId).isPresent()
                || friendshipRepository.findByRequesterIdAndRecipientId(targetUserId, userId).isPresent();
        if (alreadyExists) {
            throw new DuplicateFriendRequestException("A friend request already exists between these accounts");
        }

        Friendship friendship = friendshipRepository.save(new Friendship(userId, targetUserId));
        return toResponse(friendship, userId);
    }

    @Transactional
    public FriendshipResponse respond(String userId, Long friendshipId, boolean accept) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new EntityNotFoundException("Friend request not found: " + friendshipId));

        if (!userId.equals(friendship.getRecipientId())) {
            throw new ForbiddenException("Friend request does not belong to user: " + userId);
        }

        friendship.setStatus(accept ? Friendship.ACCEPTED : Friendship.DECLINED);
        friendshipRepository.save(friendship);

        if (accept) {
            String accepterName = userLookupService.resolve(userId).displayName();
            appNotificationService.notify(
                    friendship.getRequesterId(),
                    AppNotification.FRIEND_REQUEST_ACCEPTED,
                    "Friend request accepted",
                    accepterName + " accepted your friend request",
                    null, null, null);
        }

        return toResponse(friendship, userId);
    }

    public List<FriendshipResponse> listFriends(String userId) {
        List<Friendship> asRequester = friendshipRepository.findByRequesterIdAndStatus(userId, Friendship.ACCEPTED);
        List<Friendship> asRecipient = friendshipRepository.findByRecipientIdAndStatus(userId, Friendship.ACCEPTED);

        List<FriendshipResponse> result = new ArrayList<>();
        asRequester.forEach(f -> result.add(toResponse(f, userId)));
        asRecipient.forEach(f -> result.add(toResponse(f, userId)));
        return result;
    }

    public List<FriendshipResponse> listPendingRequests(String userId) {
        return friendshipRepository.findByRecipientIdAndStatus(userId, Friendship.PENDING).stream()
                .map(f -> toResponse(f, userId))
                .toList();
    }

    /** True if userId and otherId have an ACCEPTED friendship in either direction. */
    public boolean areFriends(String userId, String otherId) {
        Optional<Friendship> forward = friendshipRepository.findByRequesterIdAndRecipientId(userId, otherId);
        Optional<Friendship> backward = friendshipRepository.findByRequesterIdAndRecipientId(otherId, userId);
        return forward.map(f -> Friendship.ACCEPTED.equals(f.getStatus())).orElse(false)
                || backward.map(f -> Friendship.ACCEPTED.equals(f.getStatus())).orElse(false);
    }

    private FriendshipResponse toResponse(Friendship friendship, String viewingUserId) {
        String otherUserId = viewingUserId.equals(friendship.getRequesterId())
                ? friendship.getRecipientId()
                : friendship.getRequesterId();

        UserProfile other = userLookupService.resolve(otherUserId);

        return new FriendshipResponse(
                friendship.getId(), otherUserId, other.displayName(), other.email(),
                friendship.getStatus(), friendship.getCreatedAt());
    }
}
