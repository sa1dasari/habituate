import { TOUR_STEPS, TOUR_SCOPES, TOUR_TARGETS, getSkylineTabRoute } from './onboardingTour';

describe('onboarding tour', () => {
  test('has the five approved steps in order', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      'skyline',
      'hold-to-build',
      'tap-a-tower',
      'community',
      'profile',
    ]);
    TOUR_STEPS.forEach((s, i) => expect(s.eyebrow).toBe(`${i + 1} OF 5`));
  });

  test('every step has a known scope and a registered target key', () => {
    const scopes = Object.values(TOUR_SCOPES);
    const targets = Object.values(TOUR_TARGETS);
    TOUR_STEPS.forEach((s) => {
      expect(scopes).toContain(s.scope);
      expect(targets).toContain(s.targetKey);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    });
    expect(new Set(TOUR_STEPS.map((s) => s.targetKey)).size).toBe(TOUR_STEPS.length);
  });

  test('only the Skyline steps switch tabs; the tab-bar steps stay put', () => {
    TOUR_STEPS.filter((s) => s.scope === TOUR_SCOPES.SKYLINE).forEach((s) => expect(s.tab).toBeTruthy());
    TOUR_STEPS.filter((s) => s.scope === TOUR_SCOPES.TABS).forEach((s) => expect(s.tab).toBeUndefined());
  });

  test('skyline tab route is the dev tab in dev, Today in release', () => {
    expect(getSkylineTabRoute(true)).toBe('SkylineReal');
    expect(getSkylineTabRoute(false)).toBe('Today');
  });
});
