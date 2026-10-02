package com.habituate.api.groups;

import java.util.Optional;

/**
 * Wraps Firebase Admin SDK user lookups behind an interface so
 * FriendshipService/GroupService can be tested with a mocked implementation
 * instead of depending on real accounts existing in the Firebase project —
 * there's no local users table (userId is a raw Firebase UID everywhere in
 * this codebase), so this is the only way to resolve an email to a UID or a
 * UID to a display name.
 */
public interface UserLookupService {
    /** Empty if no Firebase user has this email. */
    Optional<UserProfile> findByEmail(String email);

    /** Never throws — falls back to a uid-based profile if the lookup fails, since a profile lookup failure shouldn't break listing groups/friends. */
    UserProfile resolve(String uid);
}
