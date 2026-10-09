import { cadenceTarget, hasDailyTarget } from './cadence';
import { toDateKey } from './date';

/** Sum of check-in values a habit logged on one calendar day (BOOLEAN check-ins default to 1). */
export function sumValueForDay(habit, dayKey) {
  return (habit.checkIns || []).reduce((sum, ci) => {
    if (toDateKey(new Date(ci.occurredAt)) !== dayKey) return sum;
    return sum + (Number(ci.value) || 1);
  }, 0);
}

/** A habit only counts toward a day's stats once it actually existed — a habit
 * created today shouldn't retroactively make yesterday look incomplete. */
export function existedOn(habit, dayKey) {
  if (!habit || !habit.createdAt) return true;
  return toDateKey(new Date(habit.createdAt)) <= dayKey;
}

/**
 * Per-day stats: how many of that day's daily-target habits (only ones that
 * existed by then) were completed — a COUNT habit needs its values to sum to
 * its daily target, so a batch of 9 job applications still counts as one
 * habit "done", not nine — plus every other habit (weekly/monthly-only).
 * A BOOLEAN weekly/monthly habit always gets an entry, done or not, so the
 * calendar's day-detail panel has a row to tap and log it for that day
 * (same backdating a daily habit already gets) — a COUNT one only shows up
 * when it actually has logged activity that day, since COUNT stays view-only
 * there (ambiguous amount / which check-in to undo from a bare tap).
 */
export function computeDayStats(dayKey, habits) {
  const entries = [];
  let dailyTotal = 0;
  let dailyDone = 0;

  const existing = habits.filter((h) => existedOn(h, dayKey));

  existing.forEach((habit) => {
    if (!hasDailyTarget(habit)) return;
    dailyTotal += 1;
    const value = sumValueForDay(habit, dayKey);
    const target = cadenceTarget(habit);
    const done = value >= target;
    if (done) dailyDone += 1;
    entries.push({ habit, value, isDaily: true, done });
  });

  existing.forEach((habit) => {
    if (hasDailyTarget(habit)) return;
    const value = sumValueForDay(habit, dayKey);
    const done = value > 0;
    if (done || habit.trackingMode !== 'COUNT') {
      entries.push({ habit, value, isDaily: false, done });
    }
  });

  return { dailyTotal, dailyDone, entries };
}

/** Fraction of that day's daily-target habits completed, 0 when there's nothing to grade. */
export function dayHeatRatio(stats) {
  if (!stats || stats.dailyTotal === 0) return 0;
  return Math.max(0, Math.min(1, stats.dailyDone / stats.dailyTotal));
}
