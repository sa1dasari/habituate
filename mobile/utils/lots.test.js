const { buildLots, checkInsInPeriod } = require('./lots');

function ci(dateStr, value) {
  return { occurredAt: `${dateStr}T09:00:00`, value: value != null ? value : 1 };
}

function weeklyHabit(overrides = {}) {
  return {
    id: 'w1',
    name: 'Gym',
    color: '#ff0000',
    trackingMode: 'BOOLEAN',
    weeklyTarget: 3,
    monthlyTarget: null,
    checkIns: [],
    ...overrides,
  };
}

describe('buildLots — weekly', () => {
  test('one row per habit, oldest period first, newest (current) last', () => {
    const { rows } = buildLots([weeklyHabit()], { today: new Date('2026-02-11T12:00:00') });
    expect(rows).toHaveLength(1);
    expect(rows[0].periods).toHaveLength(8);
    expect(rows[0].periods[rows[0].periods.length - 1].isCurrent).toBe(true);
    expect(rows[0].periods[0].isCurrent).toBe(false);
  });

  test('a weekly period carries exactly 7 day cells, Monday through Sunday', () => {
    const { rows } = buildLots([weeklyHabit()], { today: new Date('2026-02-11T12:00:00') }); // Wednesday, week of 02-09
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.days).toHaveLength(7);
    expect(current.days[0].dateKey).toBe('2026-02-09'); // Monday
    expect(current.days[6].dateKey).toBe('2026-02-15'); // Sunday
  });

  test('each day cell reflects that specific calendar day, not a sequential fill', () => {
    // Logged Monday and Thursday only — the lit cells should land on those
    // exact weekday positions, not the first two slots in the row.
    const checkIns = [ci('2026-02-09'), ci('2026-02-12')];
    const { rows } = buildLots([weeklyHabit({ checkIns })], { today: new Date('2026-02-11T12:00:00') });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.days[0].level).toBe(1); // Mon 02-09
    expect(current.days[1].level).toBe(0); // Tue 02-10
    expect(current.days[3].level).toBe(1); // Thu 02-12
  });

  test('a day cell level is clamped to 3 regardless of how many check-ins land that day', () => {
    const checkIns = ['2026-02-09T08:00:00', '2026-02-09T12:00:00', '2026-02-09T18:00:00', '2026-02-09T20:00:00'].map((occurredAt) => ({
      occurredAt,
      value: 1,
    }));
    const habit = weeklyHabit({ trackingMode: 'COUNT', checkIns });
    const { rows } = buildLots([habit], { today: new Date('2026-02-11T12:00:00') });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.days[0].level).toBe(3);
  });

  test('today is flagged on exactly one day cell, and days after it are flagged future', () => {
    const { rows } = buildLots([weeklyHabit()], { today: new Date('2026-02-11T12:00:00') }); // Wednesday, week of 02-09
    const current = rows[0].periods[rows[0].periods.length - 1];
    const todayCells = current.days.filter((d) => d.isToday);
    expect(todayCells).toHaveLength(1);
    expect(todayCells[0].dateKey).toBe('2026-02-11');
    expect(current.days[2].isFuture).toBe(false); // Wed 02-11 itself (index 2) is today, not future
    expect(current.days[3].isFuture).toBe(true); // Thu 02-12 hasn't happened yet
  });

  test('a met week is not broken by an unmet in-progress current week, and the current week only joins the run if it is itself met', () => {
    const today = new Date('2026-02-11T12:00:00'); // Wednesday, week of 2026-02-09
    // Previous week (2026-02-02 to 02-08) fully met (3 days logged).
    const checkIns = [ci('2026-02-02'), ci('2026-02-03'), ci('2026-02-04')];
    const habit = weeklyHabit({ checkIns });
    const { rows } = buildLots([habit], { today });
    const periods = rows[0].periods;
    const current = periods[periods.length - 1];
    const previous = periods[periods.length - 2];
    expect(current.met).toBe(false);
    expect(previous.met).toBe(true);
    expect(previous.inRunBand).toBe(true); // not broken by the unmet in-progress week
    expect(current.inRunBand).toBe(false); // current itself isn't met, so it doesn't join
    expect(rows[0].currentRun).toBe(1);
  });

  test('bestRun reflects a longer run earlier in history than the current (possibly broken) one', () => {
    const today = new Date('2026-02-11T12:00:00'); // Wednesday, week of 2026-02-09; 8-week window starts 2025-12-22
    // Three consecutive met weeks right at the start of the window, nothing since — current run is 0.
    const checkIns = [
      ci('2025-12-22'), ci('2025-12-23'), ci('2025-12-24'),
      ci('2025-12-29'), ci('2025-12-30'), ci('2025-12-31'),
      ci('2026-01-05'), ci('2026-01-06'), ci('2026-01-07'),
    ];
    const habit = weeklyHabit({ checkIns });
    const { rows } = buildLots([habit], { today });
    expect(rows[0].currentRun).toBe(0);
    expect(rows[0].bestRun).toBe(3);
  });

  test('bestRun is never less than currentRun even when the current run is the best one', () => {
    const today = new Date('2026-02-11T12:00:00');
    const checkIns = [ci('2026-02-02'), ci('2026-02-03'), ci('2026-02-04')]; // previous week met, current in-progress
    const habit = weeklyHabit({ checkIns });
    const { rows } = buildLots([habit], { today });
    expect(rows[0].currentRun).toBe(1);
    expect(rows[0].bestRun).toBe(1);
  });

  test('a shielded week renders as a plain protected block, not open and not counted from check-ins', () => {
    const today = new Date('2026-02-11T12:00:00');
    const habit = weeklyHabit({ shieldPeriods: new Set(['2026-02-09']) });
    const { rows } = buildLots([habit], { today });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.shielded).toBe(true);
    expect(current.met).toBe(true);
    expect(current.days).toEqual([]);
  });

  test('a habit created mid-week (an early check-in from before the habit existed in this cadence) still buckets cleanly without throwing', () => {
    // "Cadence change" fixture: check-ins exist from before weeklyTarget was
    // set on this habit — buildLots doesn't know or care about past cadence,
    // it just buckets every check-in into the period window it falls in.
    const habit = weeklyHabit({ checkIns: [ci('2025-01-01'), ci('2026-02-10')] });
    expect(() => buildLots([habit], { today: new Date('2026-02-11T12:00:00') })).not.toThrow();
    const { rows } = buildLots([habit], { today: new Date('2026-02-11T12:00:00') });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.days.filter((d) => d.level > 0)).toHaveLength(1); // only 2026-02-10 falls in the current week
  });

  test('openToday counts a row whose current period is not yet met', () => {
    const met = weeklyHabit({ id: 'met', checkIns: [ci('2026-02-09'), ci('2026-02-10'), ci('2026-02-11')] });
    const unmet = weeklyHabit({ id: 'unmet', checkIns: [] });
    const { openToday } = buildLots([met, unmet], { today: new Date('2026-02-11T12:00:00') });
    expect(openToday).toBe(1);
  });
});

describe('buildLots — monthly', () => {
  function monthlyHabit(overrides = {}) {
    return {
      id: 'm1',
      name: 'Apply to jobs',
      color: '#00ff00',
      trackingMode: 'BOOLEAN',
      weeklyTarget: null,
      monthlyTarget: 10,
      checkIns: [],
      ...overrides,
    };
  }

  test('a non-leap February carries exactly 28 day cells', () => {
    const { rows } = buildLots([monthlyHabit()], { today: new Date('2026-02-15T12:00:00') });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.days).toHaveLength(28);
  });

  test('a 31-day month carries exactly 31 day cells, chunking into 5 rows of 7 (last row partial)', () => {
    const { rows } = buildLots([monthlyHabit()], { today: new Date('2026-03-15T12:00:00') });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.days).toHaveLength(31);
    expect(Math.ceil(current.days.length / 7)).toBe(5);
  });

  test('a day cell level is clamped to 3 regardless of how many check-ins land that day', () => {
    const checkIns = ['2026-03-01T08:00:00', '2026-03-01T10:00:00', '2026-03-01T12:00:00', '2026-03-01T14:00:00'].map((occurredAt) => ({
      occurredAt,
      value: 1,
    }));
    const { rows } = buildLots([monthlyHabit({ trackingMode: 'COUNT', checkIns })], { today: new Date('2026-03-01T12:00:00') });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.days[0].level).toBe(3);
  });

  test('a monthly target of 1 is still a day-grid, not a special single-pad case', () => {
    const habit = monthlyHabit({ monthlyTarget: 1, checkIns: [ci('2026-03-01')] });
    const { rows } = buildLots([habit], { today: new Date('2026-03-01T12:00:00') });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.days[0].level).toBe(1);
    expect(current.met).toBe(true);
  });

  test('a shielded month renders as a plain protected block with no day cells', () => {
    const habit = monthlyHabit({ shieldPeriods: new Set(['2026-03-01']) });
    const { rows } = buildLots([habit], { today: new Date('2026-03-15T12:00:00') });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.shielded).toBe(true);
    expect(current.days).toEqual([]);
  });
});

describe('buildLots — count habits with a period total', () => {
  test('a COUNT habit sums values for the done/target caption, not the number of logging events', () => {
    const habit = {
      id: 'c1',
      name: 'Read pages',
      color: '#0000ff',
      trackingMode: 'COUNT',
      weeklyTarget: 100,
      monthlyTarget: null,
      checkIns: [ci('2026-02-09', 20), ci('2026-02-10', 42)],
    };
    const { rows } = buildLots([habit], { today: new Date('2026-02-11T12:00:00') });
    const current = rows[0].periods[rows[0].periods.length - 1];
    // A COUNT habit always gets the verbose "N of T" caption (section 4a's
    // own example, "62 of 100 pages", is a weekly COUNT habit) — only
    // BOOLEAN weekly lots use the terse "3/3" style.
    expect(current.caption).toBe('62 of 100');
    expect(current.met).toBe(false);
  });

  test('a COUNT habit is met once the summed value reaches target', () => {
    const habit = {
      id: 'c2',
      name: 'Read pages',
      color: '#0000ff',
      trackingMode: 'COUNT',
      weeklyTarget: 50,
      monthlyTarget: null,
      checkIns: [ci('2026-02-09', 60)],
    };
    const { rows } = buildLots([habit], { today: new Date('2026-02-11T12:00:00') });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(current.met).toBe(true);
    expect(current.exceeded).toBe(true);
  });
});

describe('checkInsInPeriod', () => {
  test('returns only this period\'s check-ins, newest first', () => {
    const checkIns = [ci('2026-02-02'), ci('2026-02-09'), ci('2026-02-10'), ci('2026-02-20')];
    const { rows } = buildLots([weeklyHabit({ checkIns })], { today: new Date('2026-02-11T12:00:00') }); // week of 02-09
    const current = rows[0].periods[rows[0].periods.length - 1];
    const result = checkInsInPeriod(checkIns, current);
    expect(result).toHaveLength(2); // 02-09 and 02-10 fall in this week; 02-02 and 02-20 don't
    expect(result[0].occurredAt.slice(0, 10)).toBe('2026-02-10'); // newest first
  });

  test('returns an empty array for a shielded period (no days)', () => {
    const { rows } = buildLots([weeklyHabit({ shieldPeriods: new Set(['2026-02-09']) })], {
      today: new Date('2026-02-11T12:00:00'),
    });
    const current = rows[0].periods[rows[0].periods.length - 1];
    expect(checkInsInPeriod([], current)).toEqual([]);
  });
});

describe('buildLots — history window reaches back to habit creation', () => {
  test('a weekly habit older than the 8-week default reaches back to the Monday of its creation week', () => {
    // 2025-11-01 is a Saturday; its week starts Monday 2025-10-27.
    const habit = weeklyHabit({ startDate: '2025-11-01' });
    const { rows } = buildLots([habit], { today: new Date('2026-02-11T12:00:00') }); // week of 2026-02-09
    const oldest = rows[0].periods[0];
    expect(oldest.days[0].dateKey).toBe('2025-10-27');
  });

  test('a habit created on a Sunday still gets a full oldest week that contains that exact day', () => {
    // 2025-11-02 is a Sunday — the last day of the same week as the case above.
    const habit = weeklyHabit({ startDate: '2025-11-02' });
    const { rows } = buildLots([habit], { today: new Date('2026-02-11T12:00:00') });
    const oldest = rows[0].periods[0];
    expect(oldest.days[0].dateKey).toBe('2025-10-27');
    expect(oldest.days[6].dateKey).toBe('2025-11-02'); // creation day itself, last cell of that week
  });

  test('a habit with no startDate keeps the fixed 8-week default (unchanged behavior)', () => {
    const { rows } = buildLots([weeklyHabit()], { today: new Date('2026-02-11T12:00:00') });
    expect(rows[0].periods).toHaveLength(8);
    expect(rows[0].recentPeriods).toHaveLength(8);
  });

  test('recentPeriods stays bounded to the default window even when periods reaches back years, and both end on the same current period', () => {
    const habit = weeklyHabit({ startDate: '2025-11-01' }); // 16 periods back
    const { rows } = buildLots([habit], { today: new Date('2026-02-11T12:00:00') });
    expect(rows[0].periods.length).toBeGreaterThan(8);
    expect(rows[0].recentPeriods).toHaveLength(8);
    const periods = rows[0].periods;
    const recent = rows[0].recentPeriods;
    expect(recent[recent.length - 1]).toBe(periods[periods.length - 1]);
  });

  test('a monthly habit older than the 6-month default gets enough periods to reach its startDate', () => {
    const habit = {
      id: 'm2',
      name: 'Apply to jobs',
      color: '#00ff00',
      trackingMode: 'BOOLEAN',
      weeklyTarget: null,
      monthlyTarget: 10,
      checkIns: [],
      startDate: '2025-06-01', // ~9 months before the fixture "today" below
    };
    const { rows } = buildLots([habit], { today: new Date('2026-03-15T12:00:00') });
    const oldest = rows[0].periods[0];
    expect(oldest.days[0].dateKey.slice(0, 7)).toBe('2025-06');
  });
});

describe('buildLots — empty input', () => {
  test('handles an empty habit list without throwing', () => {
    expect(() => buildLots([], { today: new Date() })).not.toThrow();
    const { rows, openToday } = buildLots([], { today: new Date() });
    expect(rows).toEqual([]);
    expect(openToday).toBe(0);
  });
});
