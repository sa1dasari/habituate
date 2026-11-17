const { toSceneHabit, deriveBestRunWindow } = require('./skylineAdapter');

function ci(day, value = 1) {
  return { occurredAt: `${day}T12:00:00`, value };
}

describe('deriveBestRunWindow', () => {
  test('finds the most recent run matching longestStreak exactly', () => {
    const habit = { longestStreak: 3 };
    const setDays = new Set(['2026-11-01', '2026-11-02', '2026-11-05', '2026-11-06', '2026-11-07']);
    expect(deriveBestRunWindow(habit, setDays)).toEqual({ startDate: '2026-11-05', endDate: '2026-11-07' });
  });

  test('returns null when no run in the loaded days matches the length', () => {
    const habit = { longestStreak: 10 };
    const setDays = new Set(['2026-11-01', '2026-11-02']);
    expect(deriveBestRunWindow(habit, setDays)).toBeNull();
  });

  test('returns null when longestStreak is 0 or missing', () => {
    expect(deriveBestRunWindow({ longestStreak: 0 }, new Set(['2026-11-01']))).toBeNull();
    expect(deriveBestRunWindow({}, new Set(['2026-11-01']))).toBeNull();
  });

  test('a single-day run matches length 1', () => {
    const habit = { longestStreak: 1 };
    const setDays = new Set(['2026-11-03']);
    expect(deriveBestRunWindow(habit, setDays)).toEqual({ startDate: '2026-11-03', endDate: '2026-11-03' });
  });
});

describe('toSceneHabit', () => {
  const categoryColors = { Fitness: '#f97316', Other: '#6b7280' };

  test('BOOLEAN daily habit: any logged day is set', () => {
    const habit = {
      id: 1,
      name: 'Run',
      category: 'Fitness',
      cadenceType: 'DAILY',
      cadenceTarget: 1,
      trackingMode: 'BOOLEAN',
      createdAt: '2026-11-01T00:00:00',
      checkIns: [ci('2026-11-02'), ci('2026-11-04')],
      streak: 1,
      longestStreak: 1,
    };
    const scene = toSceneHabit(habit, categoryColors);
    expect(scene.checkInDays).toEqual(new Set(['2026-11-02', '2026-11-04']));
    expect(scene.color).toBe('#f97316');
    expect(scene.currentRun).toBe(1);
    expect(scene.state).toBe('active');
  });

  test('COUNT daily habit: only days meeting the target are set', () => {
    const habit = {
      id: 2,
      name: 'Pushups',
      category: 'Fitness',
      cadenceType: 'DAILY',
      cadenceTarget: 20,
      trackingMode: 'COUNT',
      createdAt: '2026-11-01T00:00:00',
      checkIns: [ci('2026-11-02', 10), ci('2026-11-02', 10), ci('2026-11-03', 5)],
      streak: 0,
      longestStreak: 0,
    };
    const scene = toSceneHabit(habit, categoryColors);
    expect(scene.checkInDays).toEqual(new Set(['2026-11-02']));
  });

  test('unknown category falls back to Other', () => {
    const habit = {
      id: 3,
      name: 'Mystery',
      category: 'NotARealCategory',
      cadenceType: 'DAILY',
      cadenceTarget: 1,
      trackingMode: 'BOOLEAN',
      createdAt: '2026-11-01T00:00:00',
      checkIns: [],
      streak: 0,
      longestStreak: 0,
    };
    expect(toSceneHabit(habit, categoryColors).color).toBe('#6b7280');
  });

  test('shieldDays is always empty (not yet solved, not a bug)', () => {
    const habit = {
      id: 4,
      name: 'Read',
      category: 'Fitness',
      cadenceType: 'DAILY',
      cadenceTarget: 1,
      trackingMode: 'BOOLEAN',
      createdAt: '2026-11-01T00:00:00',
      checkIns: [],
      streak: 0,
      longestStreak: 0,
    };
    expect(toSceneHabit(habit, categoryColors).shieldDays).toEqual([]);
  });

  describe('after a top-out', () => {
    const topped = {
      id: 9,
      name: 'Read',
      category: 'Fitness',
      cadenceType: 'DAILY',
      cadenceTarget: 1,
      trackingMode: 'BOOLEAN',
      createdAt: '2026-09-01T00:00:00',
      checkIns: [ci('2026-09-03'), ci('2026-09-04'), ci('2026-11-15')],
      streak: 1,
      longestStreak: 2,
      recentClosedSegments: [{ floorCount: 40, bestRunInSegment: 2, toppedOutAt: '2026-11-14T10:00:00' }],
    };

    test('the active tower starts at the last top-out, not createdAt', () => {
      expect(toSceneHabit(topped, categoryColors).startDate).toBe('2026-11-14');
    });

    test('a habit that never topped out still starts at createdAt', () => {
      expect(toSceneHabit({ ...topped, recentClosedSegments: [] }, categoryColors).startDate).toBe('2026-09-01');
    });

    test('a best run that ended inside the finished tower gets no ledge on the new one', () => {
      // longestStreak 2 matches Sep 3-4, which ended before 2026-11-14.
      expect(toSceneHabit(topped, categoryColors).bestRun).toBeNull();
    });
  });
});
