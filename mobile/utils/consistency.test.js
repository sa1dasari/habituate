import { totalFloorsHistory } from './consistency';

function habit(id, dates) {
  return { id, name: id, checkIns: dates.map((d, i) => ({ id: `${id}-${i}`, occurredAt: d, value: 1 })) };
}

describe('totalFloorsHistory', () => {
  test('weekly tab: 8 calendar-week buckets, last one is the current (partial) week', () => {
    // Thursday, Nov 12 2026 — the week of Nov 9 (Mon) runs Nov 9-15.
    const anchor = new Date('2026-11-12T12:00:00');
    const result = totalFloorsHistory([], 'weekly', anchor);
    expect(result.buckets).toHaveLength(8);
    expect(result.buckets[7].isCurrent).toBe(true);
    expect(result.buckets.slice(0, 7).every((b) => !b.isCurrent)).toBe(true);
    expect(result.buckets[7].label).toBe('Now');
    expect(result.currentBucketLabel).toBe('Nov 9');
  });

  test('currentTotal counts only check-ins inside the current calendar week', () => {
    const anchor = new Date('2026-11-12T12:00:00'); // Thursday, week of Nov 9
    const h = habit('read', [
      '2026-11-10T08:00:00', // inside this week (Tue)
      '2026-11-12T08:00:00', // inside this week (Thu, same day as anchor)
      '2026-11-05T08:00:00', // the previous week
    ]);
    const result = totalFloorsHistory([h], 'weekly', anchor);
    expect(result.currentTotal).toBe(2);
  });

  test('trendDelta compares the current (partial) week against the previous week at the same elapsed point', () => {
    // Anchor is Thursday (3 full days into the week: Mon, Tue, Wed, plus today).
    const anchor = new Date('2026-11-12T12:00:00');
    const h = habit('read', [
      '2026-11-09T08:00:00', // this Mon
      '2026-11-10T08:00:00', // this Tue
      // 2 so far this week
      '2026-11-02T08:00:00', // last Mon (at-this-point window)
      '2026-11-06T08:00:00', // last Fri — AFTER Thursday's elapsed point, must not count
    ]);
    const result = totalFloorsHistory([h], 'weekly', anchor);
    expect(result.currentTotal).toBe(2);
    expect(result.previousAtThisPointTotal).toBe(1);
    expect(result.trendDelta).toBe(1);
  });

  test('stacks by habit — byHabit only lists habits with a check-in in that bucket, and habitLegend covers the whole window', () => {
    const anchor = new Date('2026-11-12T12:00:00');
    const read = habit('read', ['2026-11-10T08:00:00']);
    const run = habit('run', ['2026-11-10T08:00:00', '2026-11-10T09:00:00']);
    const quiet = habit('quiet', []);
    const result = totalFloorsHistory([read, run, quiet], 'weekly', anchor);
    const currentBucket = result.buckets[result.buckets.length - 1];
    expect(currentBucket.byHabit.read).toBe(1);
    expect(currentBucket.byHabit.run).toBe(2);
    expect(currentBucket.byHabit.quiet).toBeUndefined();
    expect(result.habitLegend.map((h) => h.id).sort()).toEqual(['read', 'run']);
  });

  test('monthly tab: 6 calendar-month buckets', () => {
    const anchor = new Date('2026-11-12T12:00:00');
    const result = totalFloorsHistory([], 'monthly', anchor);
    expect(result.buckets).toHaveLength(6);
    expect(result.buckets[5].isCurrent).toBe(true);
    expect(result.periodNoun).toBe('month');
  });

  test('yearly tab: 12 calendar-month buckets, periodNoun is still "month" not "year"', () => {
    const anchor = new Date('2026-11-12T12:00:00');
    const result = totalFloorsHistory([], 'yearly', anchor);
    expect(result.buckets).toHaveLength(12);
    expect(result.periodNoun).toBe('month');
  });

  test('a weekly/monthly-target-only habit (a "lot", not a "tower") is excluded entirely', () => {
    const anchor = new Date('2026-11-12T12:00:00');
    const periodOnly = {
      id: 'gym',
      name: 'Gym',
      weeklyTarget: 3,
      cadenceTarget: 1,
      checkIns: [{ id: 'gym-1', occurredAt: '2026-11-10T08:00:00', value: 1 }],
    };
    const result = totalFloorsHistory([periodOnly], 'weekly', anchor);
    expect(result.currentTotal).toBe(0);
    expect(result.habitLegend).toEqual([]);
  });

  test('empty habits array produces zeroed buckets, not an error', () => {
    const result = totalFloorsHistory([], 'weekly', new Date('2026-11-12T12:00:00'));
    expect(result.currentTotal).toBe(0);
    expect(result.buckets.every((b) => b.value === 0)).toBe(true);
    expect(result.habitLegend).toEqual([]);
  });
});
