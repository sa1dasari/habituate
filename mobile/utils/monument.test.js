const { restorePayload, lastCheckInDayKey, buildMonument } = require('./monument');

const ci = (day) => ({ occurredAt: `${day}T12:00:00`, value: 1 });
const colors = { Other: '#abcdef', Health: '#123456' };

const habit = {
  id: 7,
  name: 'Write 300 words',
  category: 'Health',
  cadenceType: 'DAILY',
  cadenceTarget: 1,
  weeklyTarget: null,
  monthlyTarget: null,
  trackingMode: 'BOOLEAN',
  featuredGoal: false,
  scheduledTime: null,
  reminderEnabled: false,
  motivation: 'Keep going',
  topOutThresholdDays: 45,
  createdAt: '2026-03-03T10:00:00Z',
  longestStreak: 12,
};

describe('restorePayload', () => {
  test('re-sends every optional field and un-archives', () => {
    const p = restorePayload(habit);
    expect(p.archived).toBe(false);
    expect(p.topOutThresholdDays).toBe(45);
    expect(p.motivation).toBe('Keep going');
    expect(p.name).toBe('Write 300 words');
    expect(p).not.toHaveProperty('color');
  });

  test('includes color only when the habit has one', () => {
    expect(restorePayload({ ...habit, color: 'teal' }).color).toBe('teal');
    expect(restorePayload({ ...habit, color: '' })).not.toHaveProperty('color');
  });
});

describe('lastCheckInDayKey', () => {
  test('returns the newest day, or null when empty', () => {
    expect(lastCheckInDayKey([ci('2026-04-01'), ci('2026-05-09'), ci('2026-04-20')])).toBe('2026-05-09');
    expect(lastCheckInDayKey([])).toBeNull();
    expect(lastCheckInDayKey(undefined)).toBeNull();
  });
});

describe('buildMonument', () => {
  test('counts one floor per calendar day from start to the last check-in, frozen', () => {
    const m = buildMonument({ ...habit, createdAt: '2026-03-03T10:00:00' }, [ci('2026-03-03'), ci('2026-03-05')], colors);
    expect(m.totalBuilt).toBe(3);
    expect(m.sceneHabit.state).toBe('monument');
  });

  test('a monument is never buildable: it carries no closed segments or run', () => {
    const m = buildMonument(habit, [ci('2026-03-03')], colors);
    expect(m.sceneHabit.currentRun).toBe(0);
    expect(m.sceneHabit.closedSegments).toEqual([]);
  });
});
