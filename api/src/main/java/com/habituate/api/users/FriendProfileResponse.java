package com.habituate.api.users;

import java.util.List;

/**
 * What a friend sees when they tap your name/avatar — never the raw endpoint shape a caller
 * uses for their own profile (UserProfileResponse). `sharedGroupStreaks` is populated the same
 * way regardless of `visibility`: those groups are already jointly visible to the viewer (per
 * CLAUDE.md's `check_in_cheers` note on the friend-activity feed, same reasoning — a Shared
 * Habit the viewer co-tracks isn't really "the other person's private data" from the viewer's
 * side). `publicStats` is only ever non-null when `visibility` is PUBLIC.
 */
public record FriendProfileResponse(
        String userId,
        String displayName,
        String username,
        String photoUrl,
        String visibility,
        List<SharedGroupStreak> sharedGroupStreaks,
        PublicStats publicStats) {

    public record SharedGroupStreak(
            Long groupId,
            String groupName,
            int currentStreak,
            int longestStreak,
            String status) {
    }

    /** Aggregate-only, across every non-archived habit — never the per-habit breakdown.
     * consistencyPercent30d is completedDays/possibleDays over the trailing 30 days, summed
     * across all habits (mirrors CoachContextBuilder's windowStats, just totalled instead of
     * kept per-habit). memberSince is Firebase Auth's own account-creation date (nullable if
     * Firebase isn't configured or the lookup fails) — this table has no createdAt of its own. */
    public record PublicStats(
            int activeHabitCount,
            int bestCurrentStreak,
            int bestLongestStreak,
            double consistencyPercent30d,
            String memberSince) {
    }
}
