const { moonPhase } = require('./moonPhase');

describe('moonPhase', () => {
  test('a known new moon reads as new with near-zero illumination', () => {
    // 2000-01-06 18:14 UTC is the reference new moon this module is built on.
    const result = moonPhase(new Date('2000-01-06T18:14:00Z'));
    expect(result.phase).toBe('new');
    expect(result.illumination).toBeLessThan(0.05);
  });

  test('a known full moon (half a synodic month later) reads as full with near-full illumination', () => {
    const result = moonPhase(new Date('2000-01-21T04:00:00Z'));
    expect(result.phase).toBe('full');
    expect(result.illumination).toBeGreaterThan(0.95);
  });

  test('one full synodic month after a new moon reads as new again', () => {
    const result = moonPhase(new Date('2000-02-05T12:00:00Z'));
    expect(result.phase).toBe('new');
  });

  test('waxing is true in the first half of the cycle, false in the second', () => {
    expect(moonPhase(new Date('2000-01-10T00:00:00Z')).waxing).toBe(true);
    expect(moonPhase(new Date('2000-01-25T00:00:00Z')).waxing).toBe(false);
  });
});
