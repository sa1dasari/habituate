package com.habituate.api.users;

/** photoUrl comes from Firebase Auth (the only field here that isn't local data) — null
 * when the account has no profile picture set, never a placeholder URL. */
public record UserSearchResult(String userId, String username, String photoUrl) {
}
