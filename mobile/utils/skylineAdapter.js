import { toDateKey } from './date';
import { sumValueForDay } from './dayStats';
import { cadenceTarget, hasDailyTarget, isCountMode } from './cadence';

/**
 * Converts a hydrated habit (useHabits.js's shape: id, name, category,
 * checkIns, streak, longestStreak, createdAt, trackingMode, cadence*) into
 * utils/skylineScene.js's input shape (SKYLINE.md section 8). Kept out of
 * skylineScene.js on purpose — the engine's "streaks are given, not
 * recomputed" property is what keeps it pure and testable; this is the one
 * place that bridges real data into it.
 *
 * Does not recompute streak length: `currentRun` is `habit.streak` as-is.
 * `bestRun`'s length is `habit.longestStreak` as-is too — the only thing
 * derived here is which calendar days that run actually covers, so the
 * engine knows where to draw the ledge. See deriveBestRunWindow below.
 */

/** A day counts as "set" by the same rule dayStats.js's computeDayStats
 * already uses: a non-daily-target habit is set on any day it was logged at
 * all; a daily-target COUNT habit needs the day's sum to meet its target;
 * a daily-target BOOLEAN habit is set on any day it was logged. */
function isDaySet(habit, day) {
  if (!hasDailyTarget(habit)) return sumValueForDay(habit, day) > 0;
  if (isCountMode(habit)) return sumValueForDay(habit, day) >= cadenceTarget(habit);
  return sumValueForDay(habit, day) > 0;
}

function checkInDaySet(habit) {
  const candidateDays = new Set((habit.checkIns || []).map((ci) => toDateKey(ci.occurredAt)));
  const setDays = new Set();
  candidateDays.forEach((day) => {
    if (isDaySet(habit, day)) setDays.add(day);
  });
  return setDays;
}

function nextDayKey(dayKey) {
  const d = new Date(`${dayKey}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return toDateKey(d);
}

function daysBetweenInclusive(startKey, endKey) {
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  return Math.round((end - start) / 86400000) + 1;
}

/**
 * Finds a calendar-consecutive run of "set" days whose length exactly
 * matches `habit.longestStreak`, preferring the most recent such run.
 * Returns null — never a guess — when no window in the loaded check-ins
 * matches: the server's count can reflect days this client hasn't fetched,
 * or (for a COUNT habit) a target the day-key set doesn't cleanly reflect.
 * buildScene already skips the ledge when bestRun is null/absent.
 */
export function deriveBestRunWindow(habit, setDays) {
  const length = habit.longestStreak;
  if (!length || length <= 0) return null;

  const sorted = [...setDays].sort();
  const runs = [];
  let runStart = null;
  let prev = null;
  sorted.forEach((day) => {
    if (!(prev && nextDayKey(prev) === day)) {
      if (runStart) runs.push({ startDate: runStart, endDate: prev });
      runStart = day;
    }
    prev = day;
  });
  if (runStart) runs.push({ startDate: runStart, endDate: prev });

  const matches = runs.filter((r) => daysBetweenInclusive(r.startDate, r.endDate) === length);
  if (matches.length === 0) return null;
  // Most recent match (latest end date) — ties broken by recency.
  return matches.reduce((best, r) => (r.endDate > best.endDate ? r : best));
}

const FALLBACK_CATEGORY = 'Other';

/**
 * @param {object} habit - one hydrated habit from useHabits.js.
 * @param {Record<string, string>} categoryColors - resolved per-mode tower
 *   colors (theme.js's buildCategoryTowerColors()[mode]).
 */
/**
 * Converts a hydrated habit into utils/lots.js's input shape (SKYLINE.md
 * section 4a) — much lighter than toSceneHabit above, since buildLots
 * buckets raw check-ins into period windows itself rather than needing a
 * pre-classified per-day state. `shieldPeriods` is left empty, same
 * deliberate-gap reasoning as toSceneHabit's `shieldDays` — per-period
 * Shield Day storage is still open decision SKYLINE.md section 14 #1.
 */
export function toLotHabit(habit, categoryColors) {
  return {
    id: habit.id,
    name: habit.name,
    color: categoryColors[habit.category] || categoryColors[FALLBACK_CATEGORY],
    trackingMode: habit.trackingMode,
    weeklyTarget: habit.weeklyTarget,
    monthlyTarget: habit.monthlyTarget,
    checkIns: habit.checkIns || [],
    shieldPeriods: new Set(),
  };
}

export function toSceneHabit(habit, categoryColors) {
  const setDays = checkInDaySet(habit);
  return {
    id: habit.id,
    name: habit.name,
    category: habit.category,
    color: categoryColors[habit.category] || categoryColors[FALLBACK_CATEGORY],
    cadenceType: habit.cadenceType,
    cadenceTarget: habit.cadenceTarget,
    weeklyTarget: habit.weeklyTarget,
    monthlyTarget: habit.monthlyTarget,
    trackingMode: habit.trackingMode,
    dailyTargetExplicit: habit.dailyTargetExplicit,
    startDate: habit.createdAt ? toDateKey(habit.createdAt) : null,
    checkInDays: setDays,
    // Per-date Shield Day storage is an open decision (SKYLINE.md section 14
    // #1), not yet solved — glass floors aren't rendered for real habits
    // until that lands. Deliberately empty, not a bug.
    shieldDays: [],
    currentRun: habit.streak || 0,
    bestRun: deriveBestRunWindow(habit, setDays),
    // Archived/topped-out towers are Phase 3 (tower sheet, monument state) —
    // every habit reaching this adapter is rendered as 'active' for now.
    state: 'active',
  };
}
