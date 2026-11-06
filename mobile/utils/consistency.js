import { startOfMonth, startOfWeek, toDateKey } from './date';
import { calendarHeatRatio, computeDayStats, dayHeatRatio, existedOn, sumValueForDay } from './dayStats';
import { cadenceTarget, hasDailyTarget } from './cadence';

/**
 * Window lengths are approximate (30/365), not calendar-exact months/years —
 * simpler, and avoids Feb/leap-year edge cases skewing the "previous period"
 * comparison used for the trend badge.
 */
const WINDOW_DAYS = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };

export const CONSISTENCY_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];

/**
 * Past-period navigation for Insights (weekly/monthly/yearly prev/next).
 * Daily/weekly slide the trailing window back by its own length (1/7 days —
 * exactly a calendar day/week, so the per-habit breakdown's calendar-aligned
 * buckets — see habitPeriodHistory below — always land on the month/year
 * "previous" actually moved to.
 *
 * Monthly/yearly can't use a flat day count the same way: habitPeriodHistory
 * zooms into the exact calendar month/year `anchor` falls in via
 * startOfMonth/getFullYear, but calendar months run 28-31 days and years
 * 365-366 — a flat 30 or 365-day step can land back in the SAME calendar
 * month/year (e.g. Jan 31 minus 30 days is still January), making
 * "previous"/pinch-zoom visibly do nothing to the breakdown card even
 * though the ring's own trailing-window percent above it did change. Real
 * calendar steps (setMonth/setFullYear) fix that; monthly also clamps the
 * day-of-month to 1 first to dodge the classic JS Date overflow (e.g. Mar
 * 31 minus 1 month rolling into Mar 3, not February) — harmless here since
 * only the month/year identity matters, never the exact day.
 */
export function shiftAnchor(period, anchor, steps) {
  const next = new Date(anchor);
  if (period === 'monthly') {
    next.setDate(1);
    next.setMonth(next.getMonth() + steps);
  } else if (period === 'yearly') {
    next.setFullYear(next.getFullYear() + steps);
  } else {
    const days = WINDOW_DAYS[period] || WINDOW_DAYS.daily;
    next.setDate(next.getDate() + days * steps);
  }
  return next;
}

/** Whether `anchor`'s window (ending at anchor) is the one currently live, i.e. ends within
 * one window-length of right now — used to disable "next" past the live period. */
export function isCurrentPeriod(period, anchor, now = new Date()) {
  const days = WINDOW_DAYS[period] || WINDOW_DAYS.daily;
  const diffDays = (now.getTime() - anchor.getTime()) / 86400000;
  return diffDays < days;
}

/** Human label for the date range a period anchor covers, e.g. "Oct 20 – Oct 26, 2026". */
export function periodRangeLabel(period, anchor) {
  const days = WINDOW_DAYS[period] || WINDOW_DAYS.daily;
  const end = new Date(anchor);
  if (period === 'daily') {
    return end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  const start = new Date(anchor);
  start.setDate(start.getDate() - (days - 1));
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(
    'en-US',
    sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
  );
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

function dayKeysEndingAt(date, count) {
  const keys = [];
  const cursor = new Date(date);
  for (let i = 0; i < count; i++) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return keys;
}

/**
 * Days with no gradable (daily-target) habit yet are excluded from the ring
 * percent entirely, rather than counted as 0% — otherwise a brand-new
 * account would show a near-zero yearly ring purely because most of that
 * 365-day window predates the first habit.
 */
function windowStats(dayKeys, habits) {
  let ratioSum = 0;
  let gradableCount = 0;
  let fullyCompleteCount = 0;
  let mostRecentGradable = null;

  dayKeys.forEach((key) => {
    const stats = computeDayStats(key, habits);
    if (stats.dailyTotal === 0 && stats.otherDone === 0) return;
    gradableCount += 1;
    // dayHeatRatio is strictly daily-target-only by design, so an account
    // with zero daily-cadence habits (weekly/monthly only) would otherwise
    // never have a single gradable day and the ring would show "no data"
    // forever. Days that DO have a daily habit keep exactly that behavior,
    // unchanged — calendarHeatRatio only takes over once dailyTotal is 0,
    // where it reduces to "was anything logged today at all," same
    // never-penalize-a-day-it-wasn't-due rule the calendar grid already uses.
    const ratio = stats.dailyTotal > 0 ? dayHeatRatio(stats) : calendarHeatRatio(stats);
    ratioSum += ratio;
    if (ratio === 1) fullyCompleteCount += 1;
    if (!mostRecentGradable) mostRecentGradable = stats;
  });

  const percent = gradableCount === 0 ? 0 : Math.round((ratioSum / gradableCount) * 100);
  return { percent, fullyCompleteCount, gradableCount, mostRecentGradable };
}

/**
 * Consistency ring data for one of the four Insights tabs (design/Insights.png).
 * The ring percent is a smooth average completion ratio over the window; the
 * center fraction is a simpler, literal count ("5/7 days you did everything")
 * — the two are related but not algebraically identical, same as the mockup.
 */
export function computeConsistency(habits, period, now = new Date()) {
  const windowDays = WINDOW_DAYS[period] || WINDOW_DAYS.daily;

  const currentKeys = dayKeysEndingAt(now, windowDays);
  const previousAnchor = new Date(now);
  previousAnchor.setDate(previousAnchor.getDate() - windowDays);
  const previousKeys = dayKeysEndingAt(previousAnchor, windowDays);

  const current = windowStats(currentKeys, habits);
  const previous = windowStats(previousKeys, habits);

  const trendDelta = previous.gradableCount === 0 ? null : current.percent - previous.percent;

  if (period === 'daily') {
    const today = current.mostRecentGradable;
    // today.dailyTotal === 0 here means every habit the user has is
    // weekly/monthly-only (windowStats only counts a day with zero daily
    // habits as gradable when something was actually logged) — "0/0"
    // would read as nothing happened when the ring itself shows 100%.
    const centerValue = !today
      ? '0/0'
      : today.dailyTotal > 0
        ? `${today.dailyDone}/${today.dailyTotal}`
        : `${today.otherDone}/${today.otherDone}`;
    return {
      percent: current.percent,
      trendDelta,
      centerValue,
      centerLabel: 'Habits completed',
      hasData: current.gradableCount > 0,
    };
  }

  return {
    percent: current.percent,
    trendDelta,
    centerValue: `${current.fullyCompleteCount}/${windowDays}`,
    centerLabel: 'Days completed',
    hasData: current.gradableCount > 0,
  };
}

/**
 * Anti-guilt copy tiers (CLAUDE.md: trend framing over perfection framing,
 * no shaming copy, ever — including at the low end).
 */
export function consistencyMessage(percent, hasData) {
  if (!hasData) {
    return {
      title: 'Just getting started.',
      subtitle: 'Log a few check-ins and your consistency story starts showing up here.',
    };
  }
  if (percent >= 80) {
    return { title: "You're in a rhythm.", subtitle: 'A strong, sustainable pace — keep showing up like this.' };
  }
  if (percent >= 50) {
    return { title: 'Building momentum.', subtitle: "You're making steady progress — it's adding up." };
  }
  if (percent >= 20) {
    return { title: 'Getting going.', subtitle: 'Every check-in counts, no matter how small the stretch.' };
  }
  return { title: 'Early days.', subtitle: 'This is the start of the pattern, not a verdict on it.' };
}

/** Same done/not-done rule computeDayStats uses per habit, isolated to one habit. */
function habitDoneOnDay(habit, dayKey) {
  const value = sumValueForDay(habit, dayKey);
  if (hasDailyTarget(habit)) return value >= cadenceTarget(habit);
  return value > 0;
}

function formatHourLabel(hour) {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

/**
 * Per-habit bar-chart buckets for the Consistency breakdown on Insights
 * (design/Consistency detail.png) — each period tab zooms into ONE calendar
 * unit and shows its natural sub-buckets: a day broken into its 24 hours, a
 * week into its 7 days, a month into its Mon-Sun weeks, a year into its 12
 * months. This is a "zoom in one level" chart, not a multi-period trend —
 * `anchor` names which single day/week/month/year to zoom into. It shares
 * InsightsScreen's own anchor state (see shiftAnchor above) rather than a
 * separate one, so prev/next/pinch all move one consistent value — daily/
 * weekly steps are already calendar-exact (1/7 days), and shiftAnchor steps
 * monthly/yearly by real calendar units too, so the anchor this reads is
 * always genuinely inside the month/year "previous"/"next" just moved to.
 *
 * Hourly is the one level finer than a day, so it reads check-in timestamps
 * directly rather than going through computeDayStats (day-granularity
 * only). Every other level reuses the same day-level done/not-done rule as
 * the calendar heatmap, just bucketed into weeks or months instead of days.
 */
export function habitPeriodHistory(habit, period, anchor = new Date()) {
  if (period === 'daily') return buildHourlyBuckets(habit, anchor);
  if (period === 'weekly') return buildWeekDaysBuckets(habit, anchor);
  if (period === 'monthly') return buildMonthWeeksBuckets(habit, anchor);
  return buildYearMonthsBuckets(habit, anchor);
}

/** Hour-of-day buckets (0-23) for the single calendar day `anchor` falls in. */
function buildHourlyBuckets(habit, anchor) {
  const dayKey = toDateKey(anchor);
  const existed = habit ? existedOn(habit, dayKey) : false;
  const hourTotals = Array.from({ length: 24 }, () => 0);

  if (existed) {
    (habit.checkIns || []).forEach((ci) => {
      const occurred = new Date(ci.occurredAt);
      if (toDateKey(occurred) !== dayKey) return;
      hourTotals[occurred.getHours()] += Number(ci.value) || 1;
    });
  }

  const buckets = hourTotals.map((value, hour) => ({
    label: hour % 3 === 0 ? formatHourLabel(hour) : '',
    value,
    windowLen: existed ? 1 : 0,
  }));

  return { buckets, bucketCount: 24, periodWord: 'hour', currentLabel: 'Today' };
}

/** Day-of-week buckets (Mon-Sun) for the calendar week `anchor` falls in. */
function buildWeekDaysBuckets(habit, anchor) {
  const start = startOfWeek(anchor);
  const buckets = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = toDateKey(d);
    const existed = habit ? existedOn(habit, key) : false;
    buckets.push({
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      value: existed && habitDoneOnDay(habit, key) ? 1 : 0,
      windowLen: existed ? 1 : 0,
      dateKey: key,
    });
  }
  return { buckets, bucketCount: 7, periodWord: 'day', currentLabel: 'This week' };
}

/** Week-of-month buckets for the calendar month `anchor` falls in — each
 * bucket is the Mon-Sun week overlapping that month, counting only the
 * days actually inside the month (a week straddling two months doesn't
 * double-count into both). */
function buildMonthWeeksBuckets(habit, anchor) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const buckets = [];
  let cursor = startOfWeek(monthStart);
  let weekIndex = 0;

  while (cursor <= monthEnd) {
    let value = 0;
    let windowLen = 0;
    let firstInMonthDay = null;
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor);
      d.setDate(d.getDate() + i);
      if (d < monthStart || d > monthEnd) continue;
      if (!firstInMonthDay) firstInMonthDay = d;
      const key = toDateKey(d);
      if (!habit || !existedOn(habit, key)) continue;
      windowLen += 1;
      if (habitDoneOnDay(habit, key)) value += 1;
    }
    weekIndex += 1;
    // The week's own start (cursor) can fall in the previous month (e.g. a
    // month starting mid-week) — anchor on the first day of this bucket
    // that's actually inside the month so opening the calendar on it lands
    // on the right month.
    buckets.push({
      label: `W${weekIndex}`,
      value,
      windowLen,
      dateKey: toDateKey(firstInMonthDay || cursor),
    });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }

  return { buckets, bucketCount: buckets.length, periodWord: 'week', currentLabel: 'This month' };
}

/** Month-of-year buckets (Jan-Dec) for the calendar year `anchor` falls in. */
function buildYearMonthsBuckets(habit, anchor) {
  const year = anchor.getFullYear();
  const buckets = [];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1);
    const monthEnd = new Date(year, m + 1, 0);
    let value = 0;
    let windowLen = 0;
    for (const d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const key = toDateKey(d);
      if (!habit || !existedOn(habit, key)) continue;
      windowLen += 1;
      if (habitDoneOnDay(habit, key)) value += 1;
    }
    buckets.push({
      label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
      value,
      windowLen,
      dateKey: toDateKey(monthStart),
    });
  }
  return { buckets, bucketCount: 12, periodWord: 'month', currentLabel: 'This year' };
}

/**
 * Plain-language summary under the bar graph — wording depends on the zoom
 * level, since an hour bucket's "value" is a raw logged amount while a
 * day/week/month bucket's "value" is a day-count (see habitPeriodHistory).
 * Deliberately says "days" rather than the mockup's habit-specific noun
 * ("walks") — pluralizing an arbitrary habit name correctly isn't reliable,
 * and "days" stays accurate for every habit.
 */
export function habitHistorySummary(history) {
  const { buckets, periodWord, currentLabel } = history;
  const totalValue = buckets.reduce((sum, b) => sum + b.value, 0);
  const totalPossible = buckets.reduce((sum, b) => sum + b.windowLen, 0);

  if (totalPossible === 0) {
    return periodWord === 'hour' ? 'No history yet for this day.' : 'No history yet in this window.';
  }

  if (periodWord === 'hour') {
    const activeHours = buckets.filter((b) => b.value > 0).length;
    if (activeHours === 0) return `${currentLabel}: nothing logged yet.`;
    const peakHour = buckets.reduce((best, b, i) => (b.value > buckets[best].value ? i : best), 0);
    return `${currentLabel}: ${totalValue} logged across ${activeHours} hour${activeHours === 1 ? '' : 's'}, most around ${formatHourLabel(peakHour)}.`;
  }

  const totalPct = Math.round((totalValue / totalPossible) * 100);
  if (periodWord === 'day') {
    return `${currentLabel}: ${totalValue} of ${totalPossible} days (${totalPct}%).`;
  }
  const avgPerBucket = (totalValue / buckets.length).toFixed(1);
  return `${currentLabel}: ${totalValue} of ${totalPossible} days across ${buckets.length} ${periodWord}s (${totalPct}%), averaging ${avgPerBucket} days per ${periodWord}.`;
}

const GENERIC_STARTER_QUESTIONS = [
  'How am I doing this week?',
  'Help me make my routine easier.',
  'What should I focus on next?',
];

/**
 * Dynamic Ask Habituate starter questions (design/Insights.png's "Suggested
 * questions") — generated from the user's actual current habits/streaks
 * rather than three fixed strings, so they change as real check-in data
 * changes instead of staying static forever. Falls back to generic phrasing
 * wherever there isn't enough real data yet to personalize (no habits, or a
 * habit too new to have a graded week).
 */
export function generateCoachStarterQuestions(habits = [], now = new Date()) {
  if (!habits || habits.length === 0) {
    return GENERIC_STARTER_QUESTIONS;
  }

  const stats = habits.map((habit) => {
    // 'weekly' now returns this calendar week's 7 day-buckets (see
    // habitPeriodHistory) rather than a single trailing-week total, so the
    // week's ratio is summed across all 7 days instead of read off one.
    const history = habitPeriodHistory(habit, 'weekly', now);
    const totalValue = history.buckets.reduce((sum, b) => sum + b.value, 0);
    const totalWindow = history.buckets.reduce((sum, b) => sum + b.windowLen, 0);
    const ratio = totalWindow > 0 ? totalValue / totalWindow : null;
    return { habit, ratio, streak: habit.streak || 0 };
  });

  const graded = stats.filter((s) => s.ratio != null);
  const strongest = [...graded].sort((a, b) => b.ratio - a.ratio || b.streak - a.streak)[0] || null;
  const struggling = [...graded].sort((a, b) => a.ratio - b.ratio)[0] || null;
  const longestStreak = [...stats].sort((a, b) => b.streak - a.streak)[0] || null;

  const questions = [
    strongest ? `How am I doing with ${strongest.habit.name} this week?` : GENERIC_STARTER_QUESTIONS[0],
    struggling && (!strongest || struggling.habit.id !== strongest.habit.id) && struggling.ratio < 0.6
      ? `How can I make ${struggling.habit.name} easier?`
      : GENERIC_STARTER_QUESTIONS[1],
    longestStreak && longestStreak.streak > 0
      ? `How do I keep my ${longestStreak.habit.name} streak going?`
      : GENERIC_STARTER_QUESTIONS[2],
  ];

  // A small habit list can legitimately produce the same question twice
  // (e.g. one habit is both "strongest" and "longest streak") — fall back to
  // the matching generic phrasing rather than show a literal duplicate.
  const seen = new Set();
  return questions.map((q, i) => {
    if (seen.has(q)) {
      const fallback = GENERIC_STARTER_QUESTIONS[i];
      seen.add(fallback);
      return fallback;
    }
    seen.add(q);
    return q;
  });
}
