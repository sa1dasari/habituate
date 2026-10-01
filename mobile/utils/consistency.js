import { toDateKey } from './date';
import { computeDayStats, dayHeatRatio } from './dayStats';

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
