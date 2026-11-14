package com.habituate.api.habits;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;

public record HabitResponse(
        Long id,
        String userId,
        String name,
        String category,
        String cadenceType,
        Integer cadenceTarget,
        Integer weeklyTarget,
        Integer monthlyTarget,
        String trackingMode,
        boolean featuredGoal,
        String scheduledTime,
        boolean reminderEnabled,
        boolean archived,
        Instant createdAt,
        Instant updatedAt,
        int currentStreak,
        int longestStreak,
        boolean shieldedToday,
        boolean shieldEligible,
        String motivation,
        int topOutThresholdDays,
        // Phase 3d's faded-tower compositing (SKYLINE.md section 6): how
        // many segments this habit has topped out of in total, and the most
        // recent one or two of them (with their own floor counts) so the
        // client can draw them faded behind the active tower without a
        // second request per habit. Empty/zero for the overwhelming common
        // case — a habit that has never topped out.
        int closedSegmentCount,
        List<HabitTowerResponse> recentClosedSegments
) {
    public static HabitResponse from(
            Habit habit,
            int currentStreak,
            int longestStreak,
            boolean shieldedToday,
            boolean shieldEligible,
            int closedSegmentCount,
            List<HabitTowerResponse> recentClosedSegments) {
        return new HabitResponse(
                habit.getId(),
                habit.getUserId(),
                habit.getName(),
                habit.getCategory(),
                habit.getCadenceType(),
                habit.getCadenceTarget(),
                habit.getWeeklyTarget(),
                habit.getMonthlyTarget(),
                habit.getTrackingMode(),
                habit.isFeaturedGoal(),
                habit.getScheduledTime() == null
                        ? null
                        : habit.getScheduledTime().format(DateTimeFormatter.ofPattern("HH:mm")),
                habit.isReminderEnabled(),
                habit.isArchived(),
                habit.getCreatedAt(),
                habit.getUpdatedAt(),
                currentStreak,
                longestStreak,
                shieldedToday,
                shieldEligible,
                habit.getMotivation(),
                habit.getTopOutThresholdDays(),
                closedSegmentCount,
                recentClosedSegments
        );
    }
}
