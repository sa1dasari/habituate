import { toDateKey } from './date';

const MS_PER_DAY = 86400000;
export const DEFAULT_TOWER_CAP_DAYS = 30;
export const MAX_TOWER_CAP_DAYS = 35;

/**
 * When the habit's *current* tower segment started — the clock the server
 * gates Top out on (HabitService.topOutHabit measures from the open
 * segment's startedAt, not the habit's createdAt). A habit that has never
 * topped out is still on its first segment, which starts at createdAt; once
 * it has, the open segment started the moment the most recent one closed.
 * `recentClosedSegments` is oldest-first, so its last entry is the latest.
 */
export function currentSegmentStart(habit) {
  const closed = habit?.recentClosedSegments;
  if (Array.isArray(closed) && closed.length > 0) {
    const last = closed[closed.length - 1];
    if (last?.toppedOutAt) return new Date(last.toppedOutAt);
  }
  return habit?.createdAt ? new Date(habit.createdAt) : null;
}

/** Whole days since the current segment started — same rounding as the server's Duration.toDays(). */
export function currentSegmentAgeDays(habit, now = new Date()) {
  const start = currentSegmentStart(habit);
  if (!start) return 0;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY));
}

/** A habit's cap clamped to the valid 1..35 (the server enforces it too). */
export function towerCapDays(habit) {
  const raw = Number(habit?.topOutThresholdDays) || DEFAULT_TOWER_CAP_DAYS;
  return Math.max(1, Math.min(MAX_TOWER_CAP_DAYS, raw));
}

function localDayNumber(date) {
  // Local calendar day as a whole number, so DST never shifts a day.
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

/**
 * Where the current tower is against its cap, in local calendar days — the
 * same rule the server tops out on (HabitService.autoTopOutIfDue): a tower
 * started on local day D holds one floor per day and tops out at the local
 * midnight that starts D + cap. `daysStood` is 0 on the first day.
 */
export function towerCapInfo(habit, now = new Date()) {
  const capDays = towerCapDays(habit);
  const start = currentSegmentStart(habit);
  const daysStood = start ? Math.max(0, localDayNumber(now) - localDayNumber(start)) : 0;
  return { capDays, daysStood, daysToGo: Math.max(0, capDays - daysStood) };
}

/** Stable key for "this tower of this habit" — a new tower (after a top-out) has a new key. */
export function towerKey(habit) {
  const start = currentSegmentStart(habit);
  return `${habit?.id}:${start ? toDateKey(start) : 'unknown'}`;
}
