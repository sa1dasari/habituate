const { FREE_TIER_LIMITS, habitCapKey, countByCap, isAtCap, paywallCopy } = require('./entitlements');

function daily(id) {
  return { id, cadenceType: 'DAILY', cadenceTarget: 1 };
}
function weekly(id) {
  return { id, cadenceType: 'DAILY', cadenceTarget: 1, weeklyTarget: 3 };
}
function monthly(id) {
  return { id, cadenceType: 'DAILY', cadenceTarget: 1, monthlyTarget: 10 };
}

describe('habitCapKey', () => {
  test('classifies a daily, weekly and monthly habit correctly', () => {
    expect(habitCapKey(daily(1))).toBe('daily');
    expect(habitCapKey(weekly(1))).toBe('weekly');
    expect(habitCapKey(monthly(1))).toBe('monthly');
  });

  test('monthly takes priority over weekly when both targets are set', () => {
    expect(habitCapKey({ id: 1, cadenceTarget: 1, weeklyTarget: 3, monthlyTarget: 10 })).toBe('monthly');
  });
});

describe('countByCap', () => {
  test('tallies each cap independently', () => {
    const habits = [daily(1), daily(2), weekly(3), monthly(4), monthly(5)];
    expect(countByCap(habits)).toEqual({ daily: 2, weekly: 1, monthly: 2 });
  });

  test('an empty list counts zero everywhere', () => {
    expect(countByCap([])).toEqual({ daily: 0, weekly: 0, monthly: 0 });
  });
});

describe('isAtCap', () => {
  test('free-tier user is at cap once the count reaches the limit', () => {
    const counts = { daily: FREE_TIER_LIMITS.daily, weekly: 0, monthly: 0 };
    expect(isAtCap('daily', counts, false)).toBe(true);
    expect(isAtCap('weekly', counts, false)).toBe(false);
  });

  test('a pro user is never at cap', () => {
    const counts = { daily: FREE_TIER_LIMITS.daily, weekly: FREE_TIER_LIMITS.weekly, monthly: FREE_TIER_LIMITS.monthly };
    expect(isAtCap('daily', counts, true)).toBe(false);
  });
});

describe('paywallCopy', () => {
  test('matches board 88 literally for each cap, with the live count substituted', () => {
    expect(paywallCopy('daily', { daily: 5, weekly: 0, monthly: 0 })).toEqual({
      eyebrow: '5 OF 5 DAILY HABITS',
      body: 'You have 5 daily towers standing, which is what the free plan holds. Choose a plan to keep growing your skyline.',
    });
    expect(paywallCopy('weekly', { daily: 0, weekly: 1, monthly: 0 })).toEqual({
      eyebrow: '1 OF 1 WEEKLY HABIT',
      body: 'Your weekly lot is in use. The free plan holds 1 weekly habit. Choose a plan to keep growing your skyline.',
    });
    expect(paywallCopy('monthly', { daily: 0, weekly: 0, monthly: 1 })).toEqual({
      eyebrow: '1 OF 1 MONTHLY HABIT',
      body: 'Your monthly lot is in use. The free plan holds 1 monthly habit. Choose a plan to keep growing your skyline.',
    });
  });
});
