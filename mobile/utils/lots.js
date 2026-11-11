import { daysInMonth, startOfDay, startOfMonth, startOfWeek, toDateKey } from './date';

/**
 * Pure scene builder for the weekly/monthly "lots" view (SKYLINE.md section
 * 4a), mirroring utils/skylineScene.js's buildScene: no React, no I/O, no
 * clock reads — the caller passes `today`. Takes the whole habit array (not
 * one habit at a time) and returns one row per habit plus an `openToday`
 * aggregate, the same shape buildScene uses, so the view-switch badge and a
 * single memoized build-per-render both work the same way they do for the
 * daily towers.
 *
 * Each period (a week, or a month) carries a flat `days` array — one cell
 * per real calendar day (Mon..Sun for a week; day 1..last for a month) with
 * that specific day's own log count, not a sequential "houses built" tally.
 * The concept screens (concept _screens/2-weekly-monthly.png and the two
 * lot-sheet mockups) show the tile as a per-day heatmap: a weekly tile is
 * one row of 7 real weekdays, a monthly tile is N rows of 7 real calendar
 * days (chunking `days` into rows of 7 lines up with the day-block rule —
 * 1-7/8-14/15-21/22-28/29-end — for free, with no month-number
 * special-casing and no separate "ringed vs single pad" branch to maintain).
 * A shielded period carries an empty `days` array; the tile draws its own
 * plain block instead.
 *
 * Callers are expected to have already filtered to lot-eligible habits
 * (`!hasDailyTarget(habit) && (weeklyTarget > 0 || monthlyTarget > 0)`) —
 * this module doesn't re-derive that split, same division of labor as
 * skylineScene.js not re-deriving which habits are "due".
 */

const HISTORY_WEEKS = 8;
const HISTORY_MONTHS = 6;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// A short label for the month/year shown inside a lot (section 4a: "each
// box should show which month/week it is for") — just the month name
// normally, with a two-digit year appended only when it's not the same year
// as `today`, since the 6-month history can cross a New Year's boundary.
function monthShortLabel(monthStart, today) {
  const month = monthStart.toLocaleDateString('en-US', { month: 'short' });
  if (monthStart.getFullYear() === today.getFullYear()) return month;
  return `${month} '${String(monthStart.getFullYear()).slice(-2)}`;
}

function inWindow(checkIns, start, endExclusive) {
  return checkIns.filter((ci) => {
    const t = new Date(ci.occurredAt);
    return t >= start && t < endExclusive;
  });
}

/** Distinct days logged (BOOLEAN) or number of log events (COUNT) — the
 * metric that drives a day cell's 0/1/2/3+ brightness tier. Deliberately
 * not the summed numeric value for COUNT habits — that's a separate
 * `valueTotal` used only for the done/target caption. */
function logCountFor(checkIns, countMode) {
  if (countMode) return checkIns.length;
  return new Set(checkIns.map((ci) => toDateKey(ci.occurredAt))).size;
}

function valueTotalFor(checkIns, countMode) {
  if (countMode) return checkIns.reduce((sum, ci) => sum + (Number(ci.value) || 1), 0);
  return new Set(checkIns.map((ci) => toDateKey(ci.occurredAt))).size;
}

/** One calendar-day cell: its own log count (capped at 3 for the tile's
 * color tier — the legend only distinguishes "3 or more"), and whether it's
 * today or still to come, so the tile can draw a dashed outline for a
 * future day and a plain white outline for today (section 4a / the lot
 * sheet mockups), distinct from the amber "whole period met" tile border. */
function buildDayCell(date, checkIns, countMode, todayStart) {
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);
  const count = logCountFor(inWindow(checkIns, dayStart, dayEnd), countMode);
  return {
    dateKey: toDateKey(dayStart),
    dayNum: dayStart.getDate(),
    weekdayLabel: dayStart.toLocaleDateString('en-US', { weekday: 'narrow' }),
    count,
    level: Math.min(count, 3),
    isToday: dayStart.getTime() === todayStart.getTime(),
    isFuture: dayStart.getTime() > todayStart.getTime(),
  };
}

function buildDays(startDate, count, checkIns, countMode, today) {
  const todayStart = startOfDay(today);
  const days = [];
  for (let i = 0; i < count; i += 1) {
    days.push(buildDayCell(addDays(startDate, i), checkIns, countMode, todayStart));
  }
  return days;
}

// Weekly BOOLEAN lots use the spec's terse "3/3" / "1/3 now" style; a
// monthly lot or any COUNT-mode period total uses the longer "62 of 100"
// style (section 4a's own count-habit example, "62 of 100 pages", is
// itself a weekly habit — the verbose style is driven by countMode there,
// but every monthly period uses it regardless of tracking mode since a
// month's day-grid tile has no other context for how big the target is).
function periodCaption(valueTotal, target, { verbose = false, isCurrent = false } = {}) {
  if (verbose) {
    const base = `${valueTotal} of ${target}`;
    return valueTotal > target ? `${base} — exceeded` : base;
  }
  const base = `${valueTotal}/${target}`;
  if (valueTotal > target) return `${base} — exceeded`;
  if (isCurrent && valueTotal < target) return `${base} now`;
  return base;
}

/** Trailing run of consecutive met periods. The in-progress current period
 * (last element) only extends the run when it's already met — an unmet
 * current period must NOT break the run of completed periods before it
 * (same "today doesn't erase yesterday's streak" rule skylineScene.js's
 * runBandIndices applies to daily floors), so the backward walk through
 * completed periods always starts one before the current one, regardless
 * of the current period's own state. */
function markRunBand(periods) {
  const lit = new Set();
  let i = periods.length - 1;
  if (i < 0) return lit;
  if (periods[i].met) {
    lit.add(i);
  }
  i -= 1;
  for (; i >= 0; i -= 1) {
    if (!periods[i].met) break;
    lit.add(i);
  }
  return lit;
}

function buildWeeklyPeriods(habit, today, countMode, target, shieldPeriods) {
  const periods = [];
  const thisWeekStart = startOfWeek(today);
  for (let i = HISTORY_WEEKS - 1; i >= 0; i -= 1) {
    const weekStart = addDays(thisWeekStart, -7 * i);
    const weekEnd = addDays(weekStart, 7);
    const key = toDateKey(weekStart);
    const isCurrent = i === 0;
    const shielded = shieldPeriods.has(key);
    const label = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const shortLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (shielded) {
      periods.push({
        key,
        label,
        shortLabel,
        isCurrent,
        shielded: true,
        met: true, // a Shield Day protects the streak the same way it does for daily towers
        exceeded: false,
        days: [],
        countMode,
        target,
        caption: 'Shielded',
        accessibilityLabel: `${habit.name}, ${label}, shielded`,
      });
      continue;
    }

    const checkIns = inWindow(habit.checkIns, weekStart, weekEnd);
    const valueTotal = valueTotalFor(checkIns, countMode);
    const met = valueTotal >= target;
    periods.push({
      key,
      label,
      shortLabel,
      isCurrent,
      shielded: false,
      met,
      exceeded: valueTotal > target,
      days: buildDays(weekStart, 7, habit.checkIns, countMode, today),
      countMode,
      target,
      caption: periodCaption(valueTotal, target, { verbose: countMode, isCurrent }),
      accessibilityLabel: `${habit.name}, ${label}, ${valueTotal} of ${target}${met ? ', target met' : ''}`,
    });
  }
  return periods;
}

function buildMonthlyPeriods(habit, today, countMode, target, shieldPeriods) {
  const periods = [];
  const thisMonthStart = startOfMonth(today);
  for (let i = HISTORY_MONTHS - 1; i >= 0; i -= 1) {
    const monthStart = addMonths(thisMonthStart, -i);
    const monthEnd = addMonths(monthStart, 1);
    const key = toDateKey(monthStart);
    const isCurrent = i === 0;
    const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long' });
    const shortLabel = monthShortLabel(monthStart, today);
    const shielded = shieldPeriods.has(key);

    if (shielded) {
      periods.push({
        key,
        label: monthLabel,
        shortLabel,
        isCurrent,
        shielded: true,
        met: true,
        exceeded: false,
        days: [],
        countMode,
        target,
        caption: 'Shielded',
        accessibilityLabel: `${habit.name}, ${monthLabel}, shielded`,
      });
      continue;
    }

    const checkIns = inWindow(habit.checkIns, monthStart, monthEnd);
    const valueTotal = valueTotalFor(checkIns, countMode);
    const met = valueTotal >= target;
    periods.push({
      key,
      label: monthLabel,
      shortLabel,
      isCurrent,
      shielded: false,
      met,
      exceeded: valueTotal > target,
      days: buildDays(monthStart, daysInMonth(monthStart), habit.checkIns, countMode, today),
      countMode,
      target,
      caption: periodCaption(valueTotal, target, { verbose: true }),
      accessibilityLabel: `${habit.name}, ${monthLabel}, ${valueTotal} of ${target}${met ? ', target met' : ''}`,
    });
  }
  return periods;
}

/**
 * @param {Array} habits - lot-eligible habits only: { id, name, color,
 *   trackingMode, weeklyTarget, monthlyTarget, checkIns: [{occurredAt,
 *   value}], shieldPeriods?: Set<string> }
 * @param {{ today: Date }} options
 */
export function buildLots(habits, options) {
  const { today } = options;
  const rows = [];
  let openToday = 0;

  (habits || []).forEach((habit) => {
    const countMode = String(habit.trackingMode).toUpperCase() === 'COUNT';
    const shieldPeriods = habit.shieldPeriods instanceof Set ? habit.shieldPeriods : new Set();
    const monthlyTarget = Number(habit.monthlyTarget) || 0;
    const weeklyTarget = Number(habit.weeklyTarget) || 0;
    const normalizedHabit = { ...habit, checkIns: habit.checkIns || [] };

    let periodKind;
    let target;
    let periods;
    if (monthlyTarget > 0) {
      periodKind = 'monthly';
      target = monthlyTarget;
      periods = buildMonthlyPeriods(normalizedHabit, today, countMode, target, shieldPeriods);
    } else {
      periodKind = 'weekly';
      target = weeklyTarget;
      periods = buildWeeklyPeriods(normalizedHabit, today, countMode, target, shieldPeriods);
    }

    const litIndices = markRunBand(periods);
    periods.forEach((p, i) => {
      p.inRunBand = litIndices.has(i);
    });
    const currentRun = litIndices.size;
    const periodWord = periodKind === 'monthly' ? 'month' : 'week';

    const current = periods[periods.length - 1];
    if (current && !current.shielded && !current.met) openToday += 1;

    rows.push({
      habitId: habit.id,
      name: habit.name,
      color: habit.color,
      periodKind,
      target,
      countMode,
      currentRun,
      runLabel: currentRun > 0 ? `${currentRun} ${periodWord}${currentRun === 1 ? '' : 's'} run` : null,
      cadenceLabel: periodKind === 'monthly' ? `${target} a month` : `${target} a week`,
      periods,
    });
  });

  return { rows, openToday };
}
