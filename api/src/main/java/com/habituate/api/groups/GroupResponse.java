package com.habituate.api.groups;

import java.util.List;

/**
 * Shape built to satisfy mobile's SharedHabitCard prop interface directly:
 * { id, name, participants: [{name}], participantCount, streak, streakStatus, rule }.
 * rule/streakStatus are sent lowercase ('all_members'/'any_member',
 * 'safe'/'at_risk'/'frozen') to match SharedHabitCard's RULE_LABEL keys and
 * useAppTheme().resolveStreakState() exactly — no new vocabulary invented.
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
        Long myHabitId
) {
    public record Participant(String name) {
    }
}
