import { buildPeriodDetails, periodRange, shiftRange } from './insightsDetails';

function habit(id, dates, extra = {}) {
  return {
    id,
    name: String(id),
    createdAt: '2026-01-01T08:00:00',
    streak: 3,
    longestStreak: 5,
    checkIns: dates.map((d, i) => ({ id: `${id}-${i}`, occurredAt: d, value: 1 })),
    ...extra,
  };
}

// Saturday Nov 14 2026 — the week of Mon Nov 9.
const NOW = new Date('2026-11-14T12:00:00');

describe('periodRange / shiftRange', () => {
  test('a week is Monday to the next Monday', () => {
    const { start, end } = periodRange('weekly', new Date('2026-11-12T10:00:00').getTime());
    expect(start.getDate()).toBe(9);
    expect(end.getDate()).toBe(16);
  });

  test('shifting a month/year steps by calendar unit', () => {
    const m = shiftRange('monthly', new Date('2026-11-12T10:00:00').getTime(), -1);
    expect(new Date(m).getMonth()).toBe(9);
    const y = shiftRange('yearly', new Date('2026-11-12T10:00:00').getTime(), -1);
    expect(new Date(y).getFullYear()).toBe(2025);
  });
});

describe('buildPeriodDetails — week', () => {
  const read = habit('read', ['2026-11-09T08:00:00', '2026-11-10T08:00:00']);
  const gym = habit('gym', ['2026-11-10T09:00:00'], { weeklyTarget: 3, cadenceTarget: 1 });

  test('titles and tiles split floors from lot check-ins', () => {
    const d = buildPeriodDetails([read, gym], 'weekly', NOW.getTime(), {}, NOW);
    expect(d.title).toBe('Week of Nov 9');
    expect(d.eyebrow).toBe('WEEK DETAILS');
    expect(d.isCurrent).toBe(true);
    expect(d.tiles[0].number).toBe(3);
    expect(d.tiles[0].detail).toBe('2 floors · 1 lot check-in');
    expect(d.tiles[1].number).toBe('2 of 6');
  });

  test('a daily habit gets seven cells with set / glass / open / today / future states', () => {
    const d = buildPeriodDetails([read], 'weekly', NOW.getTime(), { read: ['2026-11-11'] }, NOW);
    const row = d.perHabit[0];
    expect(row.cells.map((c) => c.state)).toEqual(['set', 'set', 'glass', 'open', 'open', 'today', 'future']);
    expect(row.shieldDaysUsed).toBe(1);
  });

  test('a weekly/monthly-target habit gets a lot progress, not a strip', () => {
    const d = buildPeriodDetails([gym], 'weekly', NOW.getTime(), {}, NOW);
    const row = d.perHabit[0];
    expect(row.cells).toBeUndefined();
    expect(row.lot).toMatchObject({ target: 3, unit: 'week', inUnit: 1, remaining: 2 });
  });

  test('the chart has one slot per day and marks future days', () => {
    const d = buildPeriodDetails([read], 'weekly', NOW.getTime(), {}, NOW);
    expect(d.chart).toHaveLength(7);
    expect(d.chart[6].isFuture).toBe(true);
    expect(d.chart[0].byHabit.read).toBe(1);
  });
});

describe('buildPeriodDetails — month and year', () => {
  test('a month has a cell per calendar day', () => {
    const d = buildPeriodDetails([habit('read', [])], 'monthly', NOW.getTime(), {}, NOW);
    expect(d.title).toBe('November 2026');
    expect(d.perHabit[0].cells).toHaveLength(30);
  });

  test('a year is month-by-month with a busiest-month tile', () => {
    const read = habit('read', ['2026-03-02T08:00:00', '2026-03-03T08:00:00', '2026-10-01T08:00:00']);
    const d = buildPeriodDetails([read], 'yearly', NOW.getTime(), {}, NOW);
    expect(d.title).toBe('2026');
    expect(d.chart).toHaveLength(12);
    expect(d.tiles[1].number).toBe('Mar');
    expect(d.perHabit[0].months).toHaveLength(12);
  });

  test('a past period is not current and compares against its own previous period', () => {
    const read = habit('read', ['2026-10-05T08:00:00']);
    const d = buildPeriodDetails([read], 'monthly', new Date('2026-10-15T08:00:00').getTime(), {}, NOW);
    expect(d.isCurrent).toBe(false);
    expect(d.tiles[0].number).toBe(1);
  });
});
