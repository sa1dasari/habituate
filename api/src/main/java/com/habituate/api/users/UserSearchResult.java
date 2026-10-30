package com.habituate.api.users;

/** photoUrl comes from Firebase Auth (the only field here that isn't local data) — null
 * when the account has no profile picture set, never a placeholder URL.
 *
 * relationshipStatus tells the searching user what, if anything, already exists between
 * them and this result, so the client doesn't invite a duplicate friend request for a
 * relationship it has no other way to see (sendRequestByUsername rejects any duplicate,
 * pending or not, with DuplicateFriendRequestException — see FriendshipService.createRequest).
 * One of "FRIENDS", "REQUEST_SENT" (viewer already sent this user a pending request),
 * "REQUEST_RECEIVED" (this user already sent the viewer one), "DECLINED", or null (no
 * relationship on file — free to send a request). */
public record UserSearchResult(String userId, String username, String photoUrl, String relationshipStatus) {
}
