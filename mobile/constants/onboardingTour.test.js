import { TOUR_STEPS, TOUR_SCOPES, TOUR_TARGETS, getSkylineTabRoute } from './onboardingTour';
import { COMMUNITY_ENABLED } from './featureFlags';

describe('onboarding tour', () => {
  test('has the approved steps in order, Community included only when enabled', () => {
    const expectedIds = COMMUNITY_ENABLED
      ? ['skyline', 'hold-to-build', 'tap-a-tower', 'community', 'profile']
      : ['skyline', 'hold-to-build', 'tap-a-tower', 'profile'];
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(expectedIds);
    TOUR_STEPS.forEach((s, i) => expect(s.eyebrow).toBe(`${i + 1} OF ${TOUR_STEPS.length}`));
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
