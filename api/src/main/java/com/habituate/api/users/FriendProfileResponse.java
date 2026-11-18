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
        PublicStats publicStats,
        // Design boards 43/44 (friend skyline): towers is PUBLIC-only, no habit name or any
        // other identifying field — just enough to draw the skyline silhouette. null when
        // visibility is PRIVATE (board 44 shows only the skybridge-joined sharedGroupStreaks
        // towers instead, via SharedGroupStreak's own tower fields below).
        List<FriendTower> towers) {

    public record SharedGroupStreak(
            Long groupId,
            String groupName,
            int currentStreak,
            int longestStreak,
            String status,
            // Board 44's skybridge: the TARGET's own linked habit for this mutual group —
            // already jointly visible to the viewer as a fellow member (same reasoning as the
            // streak fields above), unlike the rest of a PRIVATE target's data.
            FriendTower theirTower) {
    }

    /** No habit name, category, id, or any other content-revealing field — board 43's "no
     * names" rule covers "what this habit is", not just its literal name, so `category` is
     * deliberately excluded too. `color` is always a valid TOWER_COLOR_PALETTE key, resolved
     * server-side (the habit's own picked colour, or a neutral "slate" default when it has
     * none) rather than the category-fallback chain the owner's own towers use, since that
     * fallback is keyed on category. floorCount/currentRun follow the same calendar-days-stood
     * rule the owner's own skyline uses — floorCount is effectively "days since this habit (or
     * its current segment) started," the one date-shaped number this view still carries.
     * closedSegmentFloorCounts is up to the 2 most recently finished towers' own heights (board
     * 43: "finished towers shown faded behind the current one, up to two"), oldest first, same
     * cap as HabitResponse.recentClosedSegments. */
    public record FriendTower(
            String color,
            int floorCount,
            int currentRun,
            List<Integer> closedSegmentFloorCounts) {
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
