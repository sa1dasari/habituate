package com.habituate.api.users;

/** Local-data-only search result (no Firebase displayName lookup here — the `users`
 * package deliberately doesn't depend on groups.UserLookupService) — the username itself
 * is the whole point of this search, so it's a fine label on its own. */
public record UserSearchResult(String userId, String username) {
}
