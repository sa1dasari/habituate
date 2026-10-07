import { toDateKey } from './date';
import { computeDayStats, dayHeatRatio, existedOn, sumValueForDay } from './dayStats';
import { cadenceTarget, hasDailyTarget } from './cadence';

/**
 * Window lengths are approximate (30/365), not calendar-exact months/years —
 * simpler, and avoids Feb/leap-year edge cases skewing the "previous period"
 * comparison used for the trend badge.
 */
const WINDOW_DAYS = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };

export const CONSISTENCY_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];

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
    if (stats.dailyTotal === 0) return;
    gradableCount += 1;
    const ratio = dayHeatRatio(stats);
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
    return {
      percent: current.percent,
      trendDelta,
      centerValue: today ? `${today.dailyDone}/${today.dailyTotal}` : '0/0',
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

/**
 * Per-habit, per-period bar-chart buckets for the Consistency detail
 * drill-down (design/Consistency detail.png). Every period uses the same
 * "days completed within a rolling window" metric, just at a different
 * window size — this is what lets daily/weekly/monthly/yearly share one
 * chart shape instead of needing bespoke logic per tab.
 */
const HISTORY_BUCKET_CONFIG = {
  daily: { windowDays: 1, bucketCount: 7, periodWord: 'day', currentLabel: 'Today' },
  weekly: { windowDays: 7, bucketCount: 4, periodWord: 'week', currentLabel: 'This week' },
  monthly: { windowDays: 30, bucketCount: 6, periodWord: 'month', currentLabel: 'This month' },
  yearly: { windowDays: 365, bucketCount: 4, periodWord: 'year', currentLabel: 'This year' },
};

/** Same done/not-done rule computeDayStats uses per habit, isolated to one habit. */
function habitDoneOnDay(habit, dayKey) {
  const value = sumValueForDay(habit, dayKey);
  if (hasDailyTarget(habit)) return value >= cadenceTarget(habit);
  return value > 0;
}

export function habitPeriodHistory(habit, period, now = new Date()) {
  const config = HISTORY_BUCKET_CONFIG[period] || HISTORY_BUCKET_CONFIG.weekly;
  const { windowDays, bucketCount, periodWord, currentLabel } = config;

  const buckets = [];
  for (let i = 0; i < bucketCount; i++) {
    // i=0 is the oldest bucket; the last one always ends at `now`.
    const bucketsFromNow = bucketCount - 1 - i;
    const bucketEnd = new Date(now);
    bucketEnd.setDate(bucketEnd.getDate() - bucketsFromNow * windowDays);
    const dayKeys = dayKeysEndingAt(bucketEnd, windowDays);

    let value = 0;
    let windowLen = 0;
    dayKeys.forEach((key) => {
      if (!habit || !existedOn(habit, key)) return;
      windowLen += 1;
      if (habitDoneOnDay(habit, key)) value += 1;
    });

    const label =
      period === 'daily'
        ? bucketEnd.toLocaleDateString('en-US', { weekday: 'short' })
        : `${periodWord[0].toUpperCase()}${i + 1}`;

    buckets.push({ label, value, windowLen });
  }

  return { buckets, windowDays, bucketCount, periodWord, currentLabel };
}

/**
 * Plain-language summary under the bar graph, e.g. "This week: 7 of 7 days
 * (100%). Across 4 weeks: 22 of 28 days (79%), averaging 5.5 days per week."
 * Deliberately says "days" rather than the mockup's habit-specific noun
 * ("walks") — pluralizing an arbitrary habit name correctly isn't reliable,
 * and "days" stays accurate for every habit.
 */
export function habitHistorySummary(history) {
  const { buckets, periodWord, currentLabel } = history;
  const current = buckets[buckets.length - 1];
  const totalValue = buckets.reduce((sum, b) => sum + b.value, 0);
  const totalPossible = buckets.reduce((sum, b) => sum + b.windowLen, 0);

  if (totalPossible === 0) {
    return "No history yet for this habit in this window.";
  }

  const currentPct = current.windowLen > 0 ? Math.round((current.value / current.windowLen) * 100) : 0;
  const totalPct = Math.round((totalValue / totalPossible) * 100);

  let text = `${currentLabel}: ${current.value} of ${current.windowLen} days (${currentPct}%).`;

  if (periodWord === 'day') {
    text += ` Across ${buckets.length} days: ${totalValue} of ${totalPossible} days completed (${totalPct}%).`;
  } else {
    const avgPerBucket = (totalValue / buckets.length).toFixed(1);
    text += ` Across ${buckets.length} ${periodWord}s: ${totalValue} of ${totalPossible} days (${totalPct}%), averaging ${avgPerBucket} days per ${periodWord}.`;
  }

  return text;
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
    const history = habitPeriodHistory(habit, 'weekly', now);
    const current = history.buckets[history.buckets.length - 1];
    const ratio = current.windowLen > 0 ? current.value / current.windowLen : null;
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
