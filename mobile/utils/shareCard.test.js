const { buildShareSceneHabit } = require('./shareCard');

const categoryColors = { Fitness: '#f97316', Other: '#6b7280' };

function ci(day, value = 1) {
  return { occurredAt: `${day}T12:00:00`, value };
}

describe('buildShareSceneHabit', () => {
  const today = new Date('2026-11-20T12:00:00');

  test('synthesizes a gap-free run of the real currentRun length', () => {
    // Real history has a gap (11-18 missing) — the habit's own streak field
    // still says 5, which is what the card should show as a clean run.
    const habit = {
      id: 1,
      name: 'Read',
      category: 'Fitness',
      cadenceType: 'DAILY',
      cadenceTarget: 1,
      trackingMode: 'BOOLEAN',
      createdAt: '2026-11-01T00:00:00',
      checkIns: [ci('2026-11-16'), ci('2026-11-19'), ci('2026-11-20')],
      streak: 5,
      longestStreak: 5,
    };

    const share = buildShareSceneHabit(habit, categoryColors, 'dark', today);

    expect(share.currentRun).toBe(5);
    expect(share.checkInDays).toEqual(['2026-11-20', '2026-11-19', '2026-11-18', '2026-11-17', '2026-11-16']);
    expect(share.startDate).toBe('2026-11-16');
    expect(share.shieldDays).toEqual([]);
    // Real color/category/state pass through untouched.
    expect(share.color).toBe('#f97316');
    expect(share.state).toBe('active');
  });

  test('a zero streak still synthesizes at least one floor, not an empty tower', () => {
    const habit = {
      id: 2,
      name: 'New habit',
      category: 'Other',
      cadenceType: 'DAILY',
      cadenceTarget: 1,
      trackingMode: 'BOOLEAN',
      createdAt: '2026-11-20T00:00:00',
      checkIns: [],
      streak: 0,
      longestStreak: 0,
    };

    const share = buildShareSceneHabit(habit, categoryColors, 'dark', today);
    expect(share.checkInDays).toEqual(['2026-11-20']);
  });
});
