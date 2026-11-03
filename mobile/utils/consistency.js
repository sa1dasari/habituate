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
 * Since every period here is already a trailing window ending at `now`
 * (not a calendar-aligned week/month/year — see the comment above), moving
 * to "the previous period" is just sliding that same window back by its
 * own length. This is the one piece of math InsightsScreen needs to add
 * prev/next without a new backend endpoint — `computeConsistency` and
 * `habitPeriodHistory` already take a `now` anchor, they just always got
 * `new Date()` before.
 */
export function shiftAnchor(period, anchor, steps) {
  const days = WINDOW_DAYS[period] || WINDOW_DAYS.daily;
  const next = new Date(anchor);
  next.setDate(next.getDate() + days * steps);
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

/**
 * Calendar-aligned navigation for the Consistency *detail* drill-down only
 * (ConsistencyDetailModal) — distinct from shiftAnchor/isCurrentPeriod/
 * periodRangeLabel above, which stay rolling-window and keep driving the
 * Insights ring unchanged. The detail chart zooms into one calendar unit at
 * a time (a day, a Mon-Sun week, a calendar month, a calendar year) and
 * shows its natural sub-buckets (hours/days/weeks/months — see
 * habitPeriodHistory below), so "previous"/"next" here means the previous
 * or next calendar unit, not "shift back by N days."
 */
export function shiftCalendarAnchor(period, anchor, steps) {
  const next = new Date(anchor);
  if (period === 'daily') next.setDate(next.getDate() + steps);
  else if (period === 'weekly') next.setDate(next.getDate() + steps * 7);
  else if (period === 'monthly') next.setMonth(next.getMonth() + steps);
  else next.setFullYear(next.getFullYear() + steps);
  return next;
}

/** Whether `anchor` falls in the calendar unit containing `now` — disables "next" past it. */
export function isCurrentCalendarPeriod(period, anchor, now = new Date()) {
  if (period === 'daily') return toDateKey(anchor) === toDateKey(now);
  if (period === 'weekly') return toDateKey(startOfWeek(anchor)) === toDateKey(startOfWeek(now));
  if (period === 'monthly') return anchor.getFullYear() === now.getFullYear() && anchor.getMonth() === now.getMonth();
  return anchor.getFullYear() === now.getFullYear();
}

/** Human label for the calendar unit `anchor` falls in, e.g. "Oct 15" / "Oct 13 – Oct 19, 2026" / "October 2026" / "2026". */
export function calendarPeriodRangeLabel(period, anchor) {
  if (period === 'daily') {
    return anchor.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  if (period === 'weekly') {
    const start = startOfWeek(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sameYear = start.getFullYear() === end.getFullYear();
    const startLabel = start.toLocaleDateString(
      'en-US',
      sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
    );
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startLabel} – ${endLabel}`;
  }
  if (period === 'monthly') {
    return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return `${anchor.getFullYear()}`;
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
 * Per-habit bar-chart buckets for the Consistency detail drill-down
 * (design/Consistency detail.png) — each period tab zooms into ONE calendar
 * unit and shows its natural sub-buckets: a day broken into its 24 hours, a
 * week into its 7 days, a month into its Mon-Sun weeks, a year into its 12
 * months. This is a "zoom in one level" chart, not a multi-period trend —
 * `anchor` names which single day/week/month/year to zoom into (see
 * shiftCalendarAnchor for how the detail modal's prev/next moves it).
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
