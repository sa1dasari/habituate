package com.habituate.api.groups;

/**
 * Pure classification of a habit's (or a group's own) effective period —
 * DAILY, WEEKLY or MONTHLY — ported from mobile's utils/cadence.js
 * (effectiveWeeklyTarget/effectiveMonthlyTarget/hasDailyTarget) so a
 * COOPERATIVE group's single cadence (SKYLINE.md decision #15) lines up
 * with the same classification the Skyline UI already uses to decide
 * whether a habit draws as a tower or a weekly/monthly lot.
 *
 * Simplification, deliberate: a habit can carry both a weeklyTarget and a
 * monthlyTarget at once (two lot tiles on the Skyline); a group's SINGLE
 * cadence cannot represent both, so when a habit has both set, WEEKLY wins
 * for the purpose of classifying it against a group. This only affects
 * which cadence a brand-new group inherits from its creator's habit, and
 * which of a joiner's own targets must match — not the habit itself.
 */
public final class GroupCadence {

    private GroupCadence() {
    }

    public enum Period {
        DAILY, WEEKLY, MONTHLY
    }

    public record Classification(Period period, int target) {
    }

    /**
     * @param cadenceType    the habit's (or group's) own DAILY/WEEKLY/MONTHLY field
     * @param cadenceTarget  the daily-scale target (Habit.cadenceTarget), used when
     *                       cadenceType alone determines the period and no explicit
     *                       weekly/monthlyTarget is set
     * @param weeklyTarget   nullable — an explicit weekly target independent of cadenceType
     * @param monthlyTarget  nullable — an explicit monthly target independent of cadenceType
     */
    public static Classification classify(String cadenceType, int cadenceTarget, Integer weeklyTarget, Integer monthlyTarget) {
        if (weeklyTarget != null && weeklyTarget > 0) {
            return new Classification(Period.WEEKLY, weeklyTarget);
        }
        if ("WEEKLY".equals(cadenceType)) {
            return new Classification(Period.WEEKLY, cadenceTarget);
        }
        if (monthlyTarget != null && monthlyTarget > 0) {
            return new Classification(Period.MONTHLY, monthlyTarget);
        }
        if ("MONTHLY".equals(cadenceType)) {
            return new Classification(Period.MONTHLY, cadenceTarget);
        }
        return new Classification(Period.DAILY, cadenceTarget);
    }
}
