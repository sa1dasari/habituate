package com.habituate.api.habits;

import java.time.Instant;

/**
 * One finished tower (design-review board 58's combined list, 2026-11-18):
 * every closed `HabitTower` segment of the caller's own non-archived
 * habits, flat (not nested under the habit, and not capped at 2 like
 * `HabitResponse.recentClosedSegments`, which exists for the skyline
 * compositing budget instead). Carries the owning habit's name/category/
 * color so the list can draw each mini faded tower without a second
 * round trip per row. A retired (archived) habit's own finished segments
 * are deliberately excluded — they stay reachable through the existing
 * Retired towers list instead, so nothing doubles up between the two.
 */
public record FinishedTowerResponse(
        Long segmentId,
        Long habitId,
        String habitName,
        String category,
        String color,
        int floorCount,
        Integer bestRunInSegment,
        Instant startedAt,
        Instant toppedOutAt,
        boolean autoToppedOut) {

    public static FinishedTowerResponse from(HabitTower segment, Habit habit, int floorCount) {
        return new FinishedTowerResponse(
                segment.getId(),
                habit.getId(),
                habit.getName(),
                habit.getCategory(),
                habit.getColor(),
                floorCount,
                segment.getBestRunInSegment(),
                segment.getStartedAt(),
                segment.getToppedOutAt(),
                segment.isAutoToppedOut());
    }
}
