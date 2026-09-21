import {
  daysInMonth,
  daysLeftInMonth,
  daysLeftInWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from './date';

/**
 * Multi-scale cadence model:
 *
 *   cadenceTarget  – times per day (for DAILY habits, e.g. "drink water 8x/day")
 *   weeklyTarget   – optional: how many times per week (e.g. gym 3x/week)
 *   monthlyTarget  – optional: how many times per month (e.g. apply for 50 jobs/month)
 *
 * Any combination is valid. A gym habit can have cadenceTarget=1, weeklyTarget=3,
 * monthlyTarget=10 simultaneously. The UI shows whichever targets are set.
 * cadenceType is kept for grouping (Daily / Weekly / Monthly sections) but no
 * longer drives the only target.
 */

export function cadenceKey(habit) {
  return String((habit && habit.cadenceType) || 'DAILY').toUpperCase();
}

/**
 * BOOLEAN (default): one check-in per day, toggled on/off — a day either
 * happened or didn't. COUNT: any number of check-ins per day, each carrying a
 * value; period totals sum those values instead of counting distinct days.
 * Needed for targets like "50 job applications this month" that can't be hit
 * one-per-day.
 */
export function isCountMode(habit) {
  return String(habit && habit.trackingMode).toUpperCase() === 'COUNT';
}

export function cadenceTarget(habit) {
  const target = Number(habit && habit.cadenceTarget);
  return Number.isFinite(target) && target > 0 ? Math.floor(target) : 1;
}

/**
 * Effective weekly target — reads the new weeklyTarget field first, then falls
 * back to cadenceTarget when cadenceType=WEEKLY (old habit shape).
 */
export function effectiveWeeklyTarget(habit) {
  if (habit && habit.weeklyTarget && habit.weeklyTarget > 0) return habit.weeklyTarget;
  if (cadenceKey(habit) === 'WEEKLY') return cadenceTarget(habit);
  return 0;
}

/**
 * Effective monthly target — reads the new monthlyTarget field first, then falls
 * back to cadenceTarget when cadenceType=MONTHLY (old habit shape).
 */
export function effectiveMonthlyTarget(habit) {
  if (habit && habit.monthlyTarget && habit.monthlyTarget > 0) return habit.monthlyTarget;
  if (cadenceKey(habit) === 'MONTHLY') return cadenceTarget(habit);
  return 0;
}

/**
 * True when the habit has a meaningful daily target — i.e. it's not purely a
 * weekly/monthly habit. Old DAILY habits and new habits without period-only
 * targets both qualify.
 */
export function hasDailyTarget(habit) {
  const key = cadenceKey(habit);
  if (key === 'WEEKLY' || key === 'MONTHLY') return false;
  // New shape: DAILY cadenceType but only period targets set → no daily target
  if (habit && (habit.weeklyTarget > 0 || habit.monthlyTarget > 0) && !habit.dailyTargetExplicit) {
    // If cadenceTarget is 1 (default) and period targets are set, treat as period-only
    return cadenceTarget(habit) > 1;
  }
  return true;
}

// ─── Period helpers ──────────────────────────────────────────────────────────

export function periodStart(period, now = new Date()) {
  switch (String(period).toUpperCase()) {
    case 'WEEKLY': return startOfWeek(now);
    case 'MONTHLY': return startOfMonth(now);
    default: return startOfDay(now);
  }
}

export function periodNoun(habit) {
  switch (cadenceKey(habit)) {
    case 'WEEKLY': return 'this week';
    case 'MONTHLY': return 'this month';
    default: return 'today';
  }
}

function sumValues(checkIns) {
  return checkIns.reduce((sum, ci) => sum + (Number(ci.value) || 1), 0);
}

/**
 * Progress within a period. BOOLEAN habits count distinct days (one tap a day
 * counts, however many times it was tapped). COUNT habits sum the value of
 * every check-in in the window — this is what makes a target like "50 this
 * month" reachable instead of capped at the number of days in the month.
 */
function countInPeriod(checkIns, period, now, habit) {
  const start = periodStart(period, now);
  const inWindow = checkIns.filter((ci) => new Date(ci.occurredAt) >= start);
  if (isCountMode(habit)) return sumValues(inWindow);

  const days = new Set();
  inWindow.forEach((ci) => days.add(toDateKey(new Date(ci.occurredAt))));
  return days.size;
}

/** Today's progress — count of taps (BOOLEAN) or sum of values (COUNT). */
function countToday(checkIns, now, habit) {
  const start = startOfDay(now);
  const inWindow = checkIns.filter((ci) => new Date(ci.occurredAt) >= start);
  return isCountMode(habit) ? sumValues(inWindow) : inWindow.length;
}

export function periodDone(habit, now = new Date()) {
  const checkIns = (habit && habit.checkIns) || [];
  if (cadenceKey(habit) === 'DAILY') return countToday(checkIns, now, habit);
  return countInPeriod(checkIns, cadenceKey(habit), now, habit);
}

/** Check-ins logged in the habit's primary cadence period, newest first. */
export function periodCheckIns(habit, now = new Date()) {
  const start = periodStart(cadenceKey(habit), now);
  return ((habit && habit.checkIns) || [])
    .filter((ci) => new Date(ci.occurredAt) >= start)
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
}

export function daysLeftInPeriod(habit, now = new Date()) {
  switch (cadenceKey(habit)) {
    case 'WEEKLY': return daysLeftInWeek(now);
    case 'MONTHLY': return daysLeftInMonth(now);
    default: return 1;
  }
}

// ─── Due-today logic ─────────────────────────────────────────────────────────

/**
 * A habit is "due today" only when it actually has a daily target — a habit
 * whose target lives at the weekly or monthly scale (gym 2x/week, 50
 * applications/month) is never "due today" on its own terms: it can be done
 * on any day of its period, so it always lives in the "This Week" / "This
 * Month" section with its own period progress, and never counts toward
 * Today's Progress. (An earlier version pulled these into "due today" once
 * slack ran out, which made the daily progress bar expect every habit to
 * happen every day — exactly the perfection-framing this app avoids.)
 */
export function isDueToday(habit, now = new Date()) {
  if (!hasDailyTarget(habit)) return false;
  const checkIns = (habit && habit.checkIns) || [];
  const dailyTarget = cadenceTarget(habit);
  return countToday(checkIns, now, habit) < dailyTarget;
}

// ─── Progress labels ──────────────────────────────────────────────────────────

/**
 * Returns an array of progress lines — one per active target scale.
 * e.g. ["3 of 8 today", "2 of 3 this week", "5 of 10 this month"]
 */
export function progressLines(habit, now = new Date()) {
  const checkIns = (habit && habit.checkIns) || [];
  const lines = [];

  const dailyTarget = cadenceTarget(habit);
  const todayCount = countToday(checkIns, now, habit);

  // Daily target (only show if > 1, otherwise it's just "done / not done")
  if (cadenceKey(habit) === 'DAILY' && dailyTarget > 1) {
    lines.push(
      todayCount >= dailyTarget
        ? `${todayCount} of ${dailyTarget} today — done`
        : `${todayCount} of ${dailyTarget} today`
    );
  }

  // Weekly target (new field or old WEEKLY cadenceType)
  const wt = effectiveWeeklyTarget(habit);
  if (wt > 0) {
    const done = countInPeriod(checkIns, 'WEEKLY', now, habit);
    lines.push(done >= wt ? `${done} of ${wt} this week — done` : `${done} of ${wt} this week`);
  }

  // Monthly target (new field or old MONTHLY cadenceType)
  const mt = effectiveMonthlyTarget(habit);
  if (mt > 0) {
    const done = countInPeriod(checkIns, 'MONTHLY', now, habit);
    lines.push(done >= mt ? `${done} of ${mt} this month — done` : `${done} of ${mt} this month`);
  }

  return lines;
}

/** Single-line summary for compact card display — picks the most relevant target. */
export function progressLabel(habit, now = new Date()) {
  const lines = progressLines(habit, now);
  // Show the most granular active target first
  return lines[0] || '';
}

// ─── cadenceProgress (used by useHabits hydration) ───────────────────────────

/** Everything Today and Habits need about where a habit stands in its period. */
export function cadenceProgress(habit, now = new Date()) {
  const checkIns = (habit && habit.checkIns) || [];
  const dailyTarget = cadenceTarget(habit);

  // Primary period progress (used for the progress bar on Today)
  const wt2 = effectiveWeeklyTarget(habit);
  const mt2 = effectiveMonthlyTarget(habit);
  let primaryDone, primaryTarget;
  if (mt2 > 0) {
    primaryDone = countInPeriod(checkIns, 'MONTHLY', now, habit);
    primaryTarget = mt2;
  } else if (wt2 > 0) {
    primaryDone = countInPeriod(checkIns, 'WEEKLY', now, habit);
    primaryTarget = wt2;
  } else {
    primaryDone = countToday(checkIns, now, habit);
    primaryTarget = dailyTarget;
  }

  // Weekly / monthly done counts (for multi-target display)
  const weeklyDone = countInPeriod(checkIns, 'WEEKLY', now, habit);
  const monthlyDone = countInPeriod(checkIns, 'MONTHLY', now, habit);

  const wt = effectiveWeeklyTarget(habit) || null;
  const mt = effectiveMonthlyTarget(habit) || null;

  // periodComplete: true when ALL set targets are met
  const primaryMet = primaryDone >= primaryTarget;
  const weeklyMet = !wt || weeklyDone >= wt;
  const monthlyMet = !mt || monthlyDone >= mt;

  return {
    countMode: isCountMode(habit),
    todayCount: countToday(checkIns, now, habit),
    periodTarget: primaryTarget,
    periodDone: primaryDone,
    weeklyTarget: wt,
    weeklyDone,
    monthlyTarget: mt,
    monthlyDone,
    periodNoun: periodNoun(habit),
    periodComplete: primaryMet && weeklyMet && monthlyMet,
    daysLeftInPeriod: daysLeftInPeriod(habit, now),
    dueToday: isDueToday(habit, now),
    progressLabel: progressLabel(habit, now),
    progressLines: progressLines(habit, now),
  };
}

// ─── Featured-goal review (previous period, for a habit pinned to Goals) ────

/**
 * Stats for the period just before the current one — e.g. "last month" for a
 * habit with a monthly target. Used to show a one-time review ("10 of 12 last
 * month") when a featured habit's period has rolled over, without needing any
 * new persisted state: it's derived from check-ins the habit already has.
 * Returns null for a habit with no weekly/monthly target — a plain daily
 * habit has nothing period-shaped to review.
 */
export function previousPeriodStats(habit, now = new Date()) {
  const mt = effectiveMonthlyTarget(habit);
  const wt = effectiveWeeklyTarget(habit);
  if (!mt && !wt) return null;

  const period = mt > 0 ? 'MONTHLY' : 'WEEKLY';
  const target = mt > 0 ? mt : wt;
  const currentStart = periodStart(period, now);

  const previousStart = period === 'MONTHLY'
    ? new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1)
    : new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - 7);

  const checkIns = (habit.checkIns || []).filter((ci) => {
    const when = new Date(ci.occurredAt);
    return when >= previousStart && when < currentStart;
  });

  const done = isCountMode(habit)
    ? sumValues(checkIns)
    : new Set(checkIns.map((ci) => toDateKey(new Date(ci.occurredAt)))).size;

  return {
    period,
    periodLabel: period === 'MONTHLY' ? 'Last month' : 'Last week',
    done,
    target,
    hit: done >= target,
  };
}
