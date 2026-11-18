import { currentSegmentAgeDays, currentSegmentStart, towerCapDays, towerCapInfo, towerKey } from './towerAge';

const NOW = new Date('2026-11-16T12:00:00Z');

describe('currentSegmentAgeDays', () => {
  test('a habit that never topped out ages from createdAt', () => {
    const h = { createdAt: '2026-09-17T12:00:00Z', recentClosedSegments: [] };
    expect(currentSegmentAgeDays(h, NOW)).toBe(60);
  });

  test('after a top-out the open segment ages from when the last one closed, not createdAt', () => {
    const h = {
      createdAt: '2026-09-17T12:00:00Z',
      recentClosedSegments: [{ toppedOutAt: '2026-11-14T12:00:00Z' }],
    };
    expect(currentSegmentAgeDays(h, NOW)).toBe(2);
  });

  test('uses the most recent closed segment when there are several (oldest first)', () => {
    const h = {
      createdAt: '2026-01-01T00:00:00Z',
      recentClosedSegments: [{ toppedOutAt: '2026-05-01T00:00:00Z' }, { toppedOutAt: '2026-11-13T12:00:00Z' }],
    };
    expect(currentSegmentAgeDays(h, NOW)).toBe(3);
  });

  test('missing data is zero, never negative', () => {
    expect(currentSegmentAgeDays({}, NOW)).toBe(0);
    expect(currentSegmentAgeDays({ createdAt: '2027-01-01T00:00:00Z' }, NOW)).toBe(0);
    expect(currentSegmentStart(null)).toBeNull();
  });
});

describe('tower cap', () => {
  const habit = (extra = {}) => ({ id: 7, createdAt: '2026-11-01T15:00:00', topOutThresholdDays: 30, recentClosedSegments: [], ...extra });

  test('the cap defaults to 30 and is clamped to 1..35', () => {
    expect(towerCapDays({})).toBe(30);
    expect(towerCapDays({ topOutThresholdDays: 3650 })).toBe(35);
    expect(towerCapDays({ topOutThresholdDays: 12 })).toBe(12);
  });

  test('days to go counts local calendar days from the tower start', () => {
    // Started Nov 1, cap 30: on Nov 1 it has stood 0 days; on Nov 28 it has 3 to go.
    expect(towerCapInfo(habit(), new Date('2026-11-01T20:00:00'))).toEqual({ capDays: 30, daysStood: 0, daysToGo: 30 });
    expect(towerCapInfo(habit(), new Date('2026-11-28T09:00:00'))).toEqual({ capDays: 30, daysStood: 27, daysToGo: 3 });
  });

  test('never goes below zero days to go', () => {
    expect(towerCapInfo(habit(), new Date('2026-12-25T09:00:00')).daysToGo).toBe(0);
  });

  test('after a top-out the new tower counts from when the old one closed', () => {
    const topped = habit({ recentClosedSegments: [{ toppedOutAt: '2026-11-20T00:00:00' }] });
    expect(towerCapInfo(topped, new Date('2026-11-22T09:00:00'))).toEqual({ capDays: 30, daysStood: 2, daysToGo: 28 });
  });

  test('a new tower has a new key, so a warning is shown once per tower', () => {
    const before = towerKey(habit());
    const after = towerKey(habit({ recentClosedSegments: [{ toppedOutAt: '2026-11-20T00:00:00' }] }));
    expect(before).not.toBe(after);
  });
});
