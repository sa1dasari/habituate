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
 * Cadence is "how many times per period", not "which days". A weekly habit with
 * a target of 3 (gym three times a week) is open on any day and tracks progress
 * across the week; a weekly habit with a target of 7 is simply an everyday
 * habit that also reports weekly progress.
 */

export function cadenceKey(habit) {
  return String((habit && habit.cadenceType) || 'DAILY').toUpperCase();
}

export function cadenceTarget(habit) {
  const target = Number(habit && habit.cadenceTarget);
  return Number.isFinite(target) && target > 0 ? Math.floor(target) : 1;
}

export function periodStart(habit, now = new Date()) {
  switch (cadenceKey(habit)) {
    case 'WEEKLY':
      return startOfWeek(now);
    case 'MONTHLY':
      return startOfMonth(now);
    default:
      return startOfDay(now);
  }
}

export function periodNoun(habit) {
  switch (cadenceKey(habit)) {
    case 'WEEKLY':
      return 'this week';
    case 'MONTHLY':
      return 'this month';
    default:
      return 'today';
  }
}

/**
 * Daily habits count every check-in (a 3x-a-day habit needs three taps);
 * weekly and monthly habits count distinct days, since "3 days of gym" is
 * three separate days, not three taps on one.
 */
export function periodDone(habit, now = new Date()) {
  const checkIns = (habit && habit.checkIns) || [];
  const start = periodStart(habit, now);
  const daily = cadenceKey(habit) === 'DAILY';
  const days = new Set();
  let count = 0;

  checkIns.forEach((checkIn) => {
    const when = new Date(checkIn.occurredAt);
    if (when < start) return;
    count += 1;
    days.add(toDateKey(when));
  });

  return daily ? count : days.size;
}

/** Check-ins logged in the habit's current period, newest first. */
export function periodCheckIns(habit, now = new Date()) {
  const start = periodStart(habit, now);

  return ((habit && habit.checkIns) || [])
    .filter((checkIn) => new Date(checkIn.occurredAt) >= start)
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
}

/** How many days of the period are still available, today included. */
export function daysLeftInPeriod(habit, now = new Date()) {
  switch (cadenceKey(habit)) {
    case 'WEEKLY':
      return daysLeftInWeek(now);
    case 'MONTHLY':
      return daysLeftInMonth(now);
    default:
      return 1;
  }
}

/**
 * Due today when the cadence leaves no slack: every daily habit, a weekly habit
 * targeting all 7 days, a monthly habit targeting every day of the month, or
 * any habit whose remaining check-ins match the days left in the period.
 */
export function isDueToday(habit, now = new Date()) {
  if (cadenceKey(habit) === 'DAILY') return true;

  const target = cadenceTarget(habit);
  const periodLength = cadenceKey(habit) === 'WEEKLY' ? 7 : daysInMonth(now);
  if (target >= periodLength) return true;

  const remaining = target - periodDone(habit, now);
  return remaining > 0 && remaining >= daysLeftInPeriod(habit, now);
}

/** Short progress line for a habit card. Returns '' when there's nothing useful to say. */
export function progressLabel(habit, now = new Date()) {
  const target = cadenceTarget(habit);
  const done = periodDone(habit, now);
  const noun = periodNoun(habit);

  if (cadenceKey(habit) === 'DAILY' && target <= 1) return '';
  if (done >= target) return `${done} of ${target} ${noun} — all done`;

  return `${done} of ${target} ${noun}`;
}

/** Everything Today and Habits need about where a habit stands in its period. */
export function cadenceProgress(habit, now = new Date()) {
  const target = cadenceTarget(habit);
  const done = periodDone(habit, now);

  return {
    periodTarget: target,
    periodDone: done,
    periodNoun: periodNoun(habit),
    periodComplete: done >= target,
    daysLeftInPeriod: daysLeftInPeriod(habit, now),
    dueToday: isDueToday(habit, now),
    progressLabel: progressLabel(habit, now),
  };
}
