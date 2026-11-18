import { toDateKey } from './date';
import { classifyDays } from './skylineScene';
import { toSceneHabit } from './skylineAdapter';

/**
 * Pure helpers for the monument sheet (design board 51) and the Retired
 * towers list's Restore action.
 */

/**
 * The full-field PUT body for un-retiring a habit. The backend applies the
 * optional fields unconditionally on a PUT (weeklyTarget, monthlyTarget,
 * motivation, topOutThresholdDays...), so every one of them is re-sent or a
 * restore would silently wipe it. `color` is only sent when the habit has one:
 * the server treats an absent/null color as "leave unchanged".
 */
export function restorePayload(habit) {
  const payload = {
    name: habit.name,
    category: habit.category,
    cadenceType: habit.cadenceType,
    cadenceTarget: habit.cadenceTarget,
    weeklyTarget: habit.weeklyTarget,
    monthlyTarget: habit.monthlyTarget,
    trackingMode: habit.trackingMode,
    featuredGoal: habit.featuredGoal,
    scheduledTime: habit.scheduledTime,
    reminderEnabled: habit.reminderEnabled,
    motivation: habit.motivation,
    topOutThresholdDays: habit.topOutThresholdDays,
    archived: false,
  };
  if (habit.color) payload.color = habit.color;
  return payload;
}

/** Day key of the newest check-in, or null when there are none. The retire
 * date isn't stored, so this is where a monument's tower "stops". */
export function lastCheckInDayKey(checkIns) {
  let latest = null;
  (checkIns || []).forEach((ci) => {
    const key = toDateKey(ci.occurredAt);
    if (!latest || key > latest) latest = key;
  });
  return latest;
}

/**
 * Scene-ready monument: the retired habit as a frozen tower (state
 * 'monument', checked-in days only up to its last check-in) plus its "Total
 * built" - the same one-floor-per-calendar-day count TowerSheet.js shows as
 * its floor number, measured to the last check-in instead of today so a
 * retired tower's number doesn't keep growing.
 */
export function buildMonument(habit, checkIns, categoryColors) {
  const hydrated = { ...habit, checkIns: checkIns || [], streak: 0 };
  const base = toSceneHabit(hydrated, categoryColors);
  const endKey = lastCheckInDayKey(checkIns) || base.startDate || toDateKey(new Date());
  const sceneHabit = { ...base, state: 'monument', closedSegments: [], bestRun: null };
  const totalBuilt = classifyDays(sceneHabit, endKey).length;
  return { sceneHabit, totalBuilt, endDate: new Date(`${endKey}T12:00:00`) };
}
