package com.habituate.api.habits;

import java.time.Instant;

/**
 * One tower segment (SKYLINE.md section 6) — oldest first when listed, the
 * last entry always the currently-open segment (toppedOutAt null). Backs
 * the Phase 3d compositing view (up to two faded closed towers behind the
 * live one) and the tower sheet's "N earlier towers" count.
 */
public record HabitTowerResponse(
        Long id,
        Instant startedAt,
        Instant toppedOutAt,
        Integer bestRunInSegment,
        int floorCount) {

    public static HabitTowerResponse from(HabitTower segment, int floorCount) {
        return new HabitTowerResponse(
                segment.getId(),
                segment.getStartedAt(),
                segment.getToppedOutAt(),
                segment.getBestRunInSegment(),
                floorCount);
    }
}
