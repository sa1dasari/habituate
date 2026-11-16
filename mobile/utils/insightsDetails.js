import { startOfMonth, startOfWeek, toDateKey } from './date';
import { hasDailyTarget } from './cadence';

// Pure builder for the Insights details page (design-review boards 31-33):
// no React, no I/O. `habits` are the raw habit records (with `.checkIns`),
// already filtered by the caller to the chip selection.

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function plural(n, word) {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function monthStart(year, month) {
  return new Date(year, month, 1);
}

function fmt(d, opts) {
  return d.toLocaleDateString('en-US', opts);
}

export function periodRange(period, startMs) {
  const base = new Date(startMs);
  if (period === 'weekly') {
    const start = startOfWeek(base);
    return { start, end: addDays(start, 7) };
  }
  if (period === 'monthly') {
    const start = startOfMonth(base);
    return { start, end: monthStart(start.getFullYear(), start.getMonth() + 1) };
  }
  const start = new Date(base.getFullYear(), 0, 1);
  return { start, end: new Date(base.getFullYear() + 1, 0, 1) };
}

export function shiftRange(period, startMs, steps) {
  const { start } = periodRange(period, startMs);
  if (period === 'weekly') return addDays(start, 7 * steps).getTime();
  if (period === 'monthly') return monthStart(start.getFullYear(), start.getMonth() + steps).getTime();
  return new Date(start.getFullYear() + steps, 0, 1).getTime();
}

function inRange(iso, start, end) {
  const t = new Date(iso);
  return t >= start && t < end;
}

function countIn(habit, start, end) {
  return (habit.checkIns || []).filter((ci) => inRange(ci.occurredAt, start, end)).length;
}

function lotTarget(habit) {
  return habit.monthlyTarget || habit.weeklyTarget || 0;
}

function lotUnit(habit) {
  return habit.monthlyTarget ? 'month' : 'week';
}

/**
 * @param habits       raw habit records, already chip-filtered
 * @param period       'weekly' | 'monthly' | 'yearly'
 * @param startMs      any instant inside the period
 * @param shieldedByHabit { [habitId]: ['YYYY-MM-DD', ...] }
 * @param now          injectable for tests
 */
export function buildPeriodDetails(habits, period, startMs, shieldedByHabit = {}, now = new Date()) {
  const { start, end } = periodRange(period, startMs);
  const isCurrent = now >= start && now < end;
  const pointEnd = isCurrent ? now : end;
  const todayKey = toDateKey(now);
  const prevStartMs = shiftRange(period, startMs, -1);
  const prevRange = periodRange(period, prevStartMs);
  const elapsedMs = pointEnd.getTime() - start.getTime();
  const prevPointEnd = new Date(prevRange.start.getTime() + elapsedMs);

  const kind = period === 'weekly' ? 'week' : period === 'monthly' ? 'month' : 'year';

  let title;
  let subtitle;
  if (period === 'weekly') {
    title = `Week of ${fmt(start, { month: 'short', day: 'numeric' })}`;
    const last = addDays(end, -1);
    subtitle = `${fmt(start, { weekday: 'short', month: 'short', day: 'numeric' })} to ${fmt(last, { weekday: 'short', month: 'short', day: 'numeric' })}`;
    if (isCurrent) subtitle += ` · today is ${fmt(now, { weekday: 'long' })}`;
  } else if (period === 'monthly') {
    title = `${MONTH_LONG[start.getMonth()]} ${start.getFullYear()}`;
    const last = addDays(end, -1);
    subtitle = `${fmt(start, { month: 'short', day: 'numeric' })} to ${fmt(last, { month: 'short', day: 'numeric' })}`;
    if (isCurrent) subtitle += ` · day ${now.getDate()} of ${last.getDate()}`;
  } else {
    title = String(start.getFullYear());
    subtitle = `Jan 1 to Dec 31${isCurrent ? ' · this year is still in progress' : ''}`;
  }

  // Day (or month, for a year) buckets the stacked chart is built from.
  const slots = [];
  if (period === 'yearly') {
    for (let m = 0; m < 12; m += 1) {
      slots.push({ key: String(m), label: MONTH_NAMES[m][0], long: MONTH_NAMES[m], start: monthStart(start.getFullYear(), m), end: monthStart(start.getFullYear(), m + 1) });
    }
  } else {
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    for (let i = 0; i < days; i += 1) {
      const d = addDays(start, i);
      slots.push({
        key: toDateKey(d),
        label: period === 'weekly' ? WEEKDAYS[i] : String(d.getDate()),
        long: fmt(d, { weekday: 'short', month: 'short', day: 'numeric' }),
        start: d,
        end: addDays(d, 1),
      });
    }
  }

  const chart = slots.map((slot) => {
    const byHabit = {};
    let total = 0;
    habits.forEach((h) => {
      const n = countIn(h, slot.start, slot.end);
      if (n > 0) {
        byHabit[h.id] = n;
        total += n;
      }
    });
    const reached = slot.start <= pointEnd;
    return { ...slot, byHabit, total, isToday: slot.key === todayKey, isFuture: !reached };
  });

  let floors = 0;
  let lots = 0;
  let prevTotal = 0;
  habits.forEach((h) => {
    const n = countIn(h, start, pointEnd);
    if (hasDailyTarget(h)) floors += n;
    else lots += n;
    prevTotal += countIn(h, prevRange.start, prevPointEnd);
  });

  const reachedSlots = chart.filter((c) => !c.isFuture);
  const daysWithBuild = reachedSlots.filter((c) => c.total > 0).length;
  const busiest = period === 'yearly' ? reachedSlots.reduce((best, c) => (!best || c.total > best.total ? c : best), null) : null;

  // Number of the prior comparison column the year tile shows ("Best month
  // so far") is the busiest *completed-or-current* month's own total.
  const tiles = [
    {
      number: floors + lots,
      label: isCurrent ? `built so far` : `built in ${kind === 'year' ? 'the year' : `the ${kind}`}`,
      detail: `${plural(floors, 'floor')} · ${plural(lots, 'lot check-in')}`,
    },
    period === 'yearly'
      ? { number: busiest && busiest.total > 0 ? busiest.long : '-', label: 'busiest month', detail: busiest && busiest.total > 0 ? `Best month so far: ${busiest.total}` : 'No builds yet' }
      : {
          number: `${daysWithBuild} of ${reachedSlots.length}`,
          label: 'days with a build',
          detail: `Last ${kind} at this point: ${prevTotal}`,
        },
  ];

  const perHabit = habits.map((h) => {
    const daily = hasDailyTarget(h);
    const count = countIn(h, start, pointEnd);
    const prevCount = countIn(h, prevRange.start, prevPointEnd);
    const shielded = new Set(shieldedByHabit[h.id] || []);
    const createdKey = h.createdAt ? toDateKey(h.createdAt) : null;
    const checkInDays = new Set((h.checkIns || []).map((ci) => toDateKey(ci.occurredAt)));
    const row = { habit: h, daily, count, prevCount, comparison: `Last ${kind === 'year' ? 'year' : kind} at this point: ${prevCount}` };

    if (daily) {
      row.shieldDaysUsed = [...shielded].filter((k) => k >= toDateKey(start) && k < toDateKey(end)).length;
      row.run = { current: h.streak || 0, best: h.longestStreak || 0 };
      if (period === 'yearly') {
        row.months = slots.map((slot) => ({ label: slot.label, value: countIn(h, slot.start, slot.end), isFuture: slot.start > pointEnd }));
        row.comparison = `Previous year: ${prevCount}`;
      } else {
        row.cells = slots.map((slot) => {
          let state;
          if (slot.start > pointEnd) state = 'future';
          else if (createdKey && slot.key < createdKey) state = 'before';
          else if (checkInDays.has(slot.key)) state = 'set';
          else if (shielded.has(slot.key)) state = 'glass';
          else if (slot.key === todayKey) state = 'today';
          else state = 'open';
          return { key: slot.key, label: slot.label, state };
        });
      }
    } else {
      const target = lotTarget(h);
      const unit = lotUnit(h);
      const unitStart = unit === 'month' ? startOfMonth(pointEnd > start ? addDays(pointEnd, -1) : start) : startOfWeek(pointEnd > start ? addDays(pointEnd, -1) : start);
      const unitEnd = unit === 'month' ? monthStart(unitStart.getFullYear(), unitStart.getMonth() + 1) : addDays(unitStart, 7);
      const inUnit = countIn(h, unitStart, unitEnd);
      row.lot = { target, unit, inUnit, remaining: Math.max(0, target - inUnit) };
      if (period === 'yearly') {
        const months = slots.map((slot) => ({ label: slot.label, value: countIn(h, slot.start, slot.end), isFuture: slot.start > pointEnd }));
        row.months = months;
      }
      if (period === 'yearly' && unit === 'month') {
        const months = row.months;
        row.lot.metMonths = months.filter((m) => !m.isFuture && target > 0 && m.value >= target).length;
        row.lot.closest = months.reduce((best, m) => (m.isFuture ? best : Math.max(best, m.value)), 0);
        row.lot.reachedMonths = months.filter((m) => !m.isFuture).length;
      }
    }
    return row;
  });

  return {
    period,
    kind,
    title,
    subtitle,
    eyebrow: `${kind.toUpperCase()} DETAILS`,
    isCurrent,
    startMs: start.getTime(),
    prevStartMs,
    nextStartMs: shiftRange(period, startMs, 1),
    tiles,
    chart,
    chartTitle: period === 'yearly' ? 'Month by month' : 'Day by day',
    perHabit,
  };
}
