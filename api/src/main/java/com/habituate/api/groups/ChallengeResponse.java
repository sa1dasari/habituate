package com.habituate.api.groups;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Shows the *viewing user's own* progress (myProgress/targetCount, matching
 * design/Community.png's "3/5 days" + "60%") alongside who else is in it —
 * a deliberate product decision, not a literal spec: CLAUDE.md only says "a
 * progress bar," not whose. For a BOOLEAN challenge, myProgress is a count of
 * ChallengeCheckIn rows; for a COUNT challenge it's the sum of their values —
 * either way it's derived, not a stored running total, so a day/entry can be
 * unlogged. checkedInToday is BOOLEAN-only (COUNT challenges can log any
 * number of times a day, so there's no single "today" entry to flag).
 *
 * Raid/team-pooled mode removed 2026-10-14 — see Challenge.java.
 */
public record ChallengeResponse(
        Long id,
        String name,
        String description,
        Integer targetCount,
        LocalDate periodStart,
        LocalDate periodEnd,
        String visibility,
        String icon,
        String color,
        String trackingMode,
        String cadenceType,
        Integer weeklyQuota,
        String customDays,
        LocalTime reminderTime,
        int myProgress,
        int progressPercent,
        boolean joined,
        boolean checkedInToday,
        List<Participant> participants,
        int participantCount,
        boolean canEdit
) {
    /** Every participant's own progress/percent/checkedInToday — not just the viewer's — so
     * the detail view can show "who's done what" instead of only your own line. Computed the
     * same way myProgress/progressPercent are (BOOLEAN: day count; COUNT: value sum). */
    public record Participant(String userId, String name, int progress, int progressPercent, boolean checkedInToday, String photoUrl) {
    }
}
