package com.habituate.api.groups;

import java.util.List;

/**
 * Shape built to satisfy mobile's SharedHabitCard prop interface directly:
 * { id, name, participants: [{name}], participantCount, streak, streakStatus, rule }.
 * rule/streakStatus are sent lowercase ('all_members'/'any_member',
 * 'safe'/'at_risk'/'frozen') to match SharedHabitCard's RULE_LABEL keys and
 * useAppTheme().resolveStreakState() exactly — no new vocabulary invented.
 *
 * streak/longestStreak/streakStatus stay meaningful only for a COOPERATIVE
 * group (the shared counter); for an INDEPENDENT group there's no shared
 * counter at all, and each Participant instead carries their own
 * currentStreak so the card can show personal streaks side-by-side.
 */
public record GroupResponse(
        Long id,
        String name,
        List<Participant> participants,
        int participantCount,
        int streak,
        int longestStreak,
        String streakStatus,
        String rule,
        Long myHabitId,
        String goalAlignment,
        String trackingMode,
        String visibilityLevel,
        boolean nudgesEnabled,
        int skipDaysPerMonth,
        boolean canEdit
) {
    /** currentStreak is null for a COOPERATIVE group (not computed — the shared counter above is authoritative);
     * populated per-member only when trackingMode is INDEPENDENT. checkedInToday is always
     * populated (whether or not this member's own linked habit has a check-in for today, UTC-
     * bucketed — same caveat already documented on GroupStreakConsumer) so the card/detail view
     * can show who's already checked in today regardless of tracking mode. */
    public record Participant(String name, String userId, Integer currentStreak, boolean checkedInToday) {
        public Participant(String name) {
            this(name, null, null, false);
        }
    }
}
