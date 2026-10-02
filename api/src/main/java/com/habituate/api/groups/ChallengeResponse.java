package com.habituate.api.groups;

import java.time.LocalDate;
import java.util.List;

/**
 * Shows the *viewing user's own* progress (myProgress/targetCount, matching
 * design/Community.png's "3/5 days" + "60%") alongside who else is in it —
 * a deliberate product decision, not a literal spec: CLAUDE.md only says "a
 * progress bar," not whose. Each participant tracks their own progressCount
 * (mirrors GoalService), not one shared group counter.
 */
public record ChallengeResponse(
        Long id,
        String name,
        String description,
        Integer targetCount,
        LocalDate periodStart,
        LocalDate periodEnd,
        int myProgress,
        int progressPercent,
        boolean joined,
        List<GroupResponse.Participant> participants,
        int participantCount
) {
}
