package com.habituate.api.groups;

import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.UserRecord;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * resolve(uid) is called once per row inside response-building loops
 * (GroupService.toResponse per member, ChallengeService.toResponse per
 * participant, GroupActivityService.recentActivity per feed row) — with no
 * cache, a 20-member group was 20 serial Firebase Admin network round-trips
 * on every listMyGroups/createGroup/invite/nudge call. A short-TTL cache
 * here fixes every current call site in one place and protects any future
 * one too, which is simpler and more durable than teaching each call site
 * to batch via getUsers(List&lt;UserIdentifier&gt;) individually.
 *
 * Plain ConcurrentHashMap with lazy (read-time) eviction rather than a
 * caching library — avoids a new dependency for what's currently a small
 * user base; unbounded map growth over a very long JVM uptime is an
 * accepted tradeoff at this scale, same spirit as this codebase's other
 * documented v1 simplifications.
 */
@Component
public class FirebaseUserLookupService implements UserLookupService {

    private static final long CACHE_TTL_MILLIS = 5 * 60 * 1000; // 5 minutes

    private record CacheEntry(UserProfile profile, long fetchedAtMillis) {
        boolean isFresh() {
            return Instant.now().toEpochMilli() - fetchedAtMillis < CACHE_TTL_MILLIS;
        }
    }

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    @Override
    public Optional<UserProfile> findByEmail(String email) {
        try {
            UserRecord record = FirebaseAuth.getInstance().getUserByEmail(email.trim());
            UserProfile profile = toProfile(record);
            cache.put(profile.uid(), new CacheEntry(profile, Instant.now().toEpochMilli()));
            return Optional.of(profile);
        } catch (FirebaseAuthException e) {
            if (e.getAuthErrorCode() == AuthErrorCode.USER_NOT_FOUND) {
                return Optional.empty();
            }
            throw new IllegalStateException("Could not look up user by email", e);
        }
    }

    @Override
    public UserProfile resolve(String uid) {
        CacheEntry cached = cache.get(uid);
        if (cached != null && cached.isFresh()) {
            return cached.profile();
        }
        try {
            UserProfile profile = toProfile(FirebaseAuth.getInstance().getUser(uid));
            cache.put(uid, new CacheEntry(profile, Instant.now().toEpochMilli()));
            return profile;
        } catch (Exception e) {
            // Don't cache the fallback — a transient lookup failure shouldn't stick
            // around for the full TTL, the next call should retry Firebase.
            return new UserProfile(uid, uid, null, null);
        }
    }

    private UserProfile toProfile(UserRecord record) {
        String name = (record.getDisplayName() != null && !record.getDisplayName().isBlank())
                ? record.getDisplayName()
                : (record.getEmail() != null ? record.getEmail() : record.getUid());
        return new UserProfile(record.getUid(), name, record.getEmail(), record.getPhotoUrl());
    }
}
