import { currentSegmentAgeDays, currentSegmentStart } from './towerAge';

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
