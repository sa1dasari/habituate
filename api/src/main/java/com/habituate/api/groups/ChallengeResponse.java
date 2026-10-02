package com.habituate.api.groups;

import java.time.LocalDate;
import java.util.List;

/**
 * Shows the *viewing user's own* progress (myProgress/targetCount, matching
 * design/Community.png's "3/5 days" + "60%") alongside who else is in it —
 * a deliberate product decision, not a literal spec: CLAUDE.md only says "a
 * progress bar," not whose. myProgress is a count of ChallengeCheckIn rows
 * (boolean, one per logged day), not a stored running total, so a day can be
 * unlogged — checkedInToday tells the client whether to offer log or unlog.
 */
public record ChallengeResponse(
        Long id,
        String name,
        String description,
        Integer targetCount,
        LocalDate periodStart,
        LocalDate periodEnd,
        String visibility,
        int myProgress,
        int progressPercent,
        boolean joined,
        boolean checkedInToday,
        List<GroupResponse.Participant> participants,
        int participantCount
) {
}
