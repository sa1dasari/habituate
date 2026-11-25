/**
 * First-time-user onboarding tour: 5 steps (design boards 46-50, SKYLINE.md
 * section 5 step 7). Each step is a dimmed overlay with a spotlight cut-out
 * around a REAL element on the Skyline screen or tab bar, plus a card.
 *
 * `scope` says which mounted TourHighlight is allowed to render the step:
 * SKYLINE is hosted by the Skyline screen (steps 1-3), TABS by the tab
 * navigator in App.js (steps 4-5, spotlighting the tab bar buttons).
 * `targetKey` is the TOUR_TARGETS key the element registered under via
 * useTourTarget. `tab` (optional) is the route to switch to first; steps
 * 4-5 omit it on purpose, the boards keep the Skyline screen underneath.
 * Copy is exactly as drawn on the boards.
 */

export const TOUR_SCOPES = {
  SKYLINE: 'skyline',
  TABS: 'tabs',
};

export const TOUR_TARGETS = {
  SKYLINE_SCENE: 'skyline-scene',
  SKYLINE_HOLD_TOWER: 'skyline-hold-tower',
  SKYLINE_SHEET: 'skyline-sheet',
  TAB_COMMUNITY: 'tab-community',
  TAB_PROFILE: 'tab-profile',
};

/**
 * The tab route that renders SkylineScreen. Always 'Today' since the
 * 2026-11-25 swap (SKYLINE.md section 14 #20) — App.js now points that
 * route at SkylineScreen in every build, dev or release; the old dev-only
 * 'SkylineReal' tab is deleted. Kept as a named export/function (rather than
 * inlining the literal) since several call sites already import it.
 */
export function getSkylineTabRoute() {
  return 'Today';
}

export const SKYLINE_TAB_ROUTE = getSkylineTabRoute();

import { COMMUNITY_ENABLED } from './featureFlags';

// Eyebrow ("N OF total") is computed below rather than hardcoded, in case a
// step is ever filtered again.
const ALL_STEPS = [
  {
    id: 'skyline',
    scope: TOUR_SCOPES.SKYLINE,
    tab: SKYLINE_TAB_ROUTE,
    targetKey: TOUR_TARGETS.SKYLINE_SCENE,
    title: 'This is your skyline',
    body: 'Every habit is a tower. Build a floor each day and your tower grows.',
  },
  {
    id: 'hold-to-build',
    scope: TOUR_SCOPES.SKYLINE,
    tab: SKYLINE_TAB_ROUTE,
    targetKey: TOUR_TARGETS.SKYLINE_HOLD_TOWER,
    title: 'Hold to build',
    body: 'Press and hold the top of a tower for about a second. Let go early and nothing is built.',
  },
  {
    id: 'tap-a-tower',
    scope: TOUR_SCOPES.SKYLINE,
    tab: SKYLINE_TAB_ROUTE,
    targetKey: TOUR_TARGETS.SKYLINE_SHEET,
    title: 'Tap a tower for more',
    body: 'See its run, edit it, add a day you missed, or ask about it. Tap a tower to open its sheet.',
  },
  // Community step (SKYLINE.md Phase 8a, revised 2026-11-23): the tab
  // itself always exists now (it shows CommunityComingSoonScreen for v1
  // instead of disappearing), so this step stays in the tour, but the copy
  // no longer promises v1 functionality that isn't actually there.
  {
    id: 'community',
    scope: TOUR_SCOPES.TABS,
    targetKey: TOUR_TARGETS.TAB_COMMUNITY,
    title: 'Community',
    body: COMMUNITY_ENABLED
      ? 'Share a habit with friends, or raise a landmark together in Community.'
      : 'Community is on its way — check back for shared habits and landmarks in a future update.',
  },
  {
    id: 'profile',
    scope: TOUR_SCOPES.TABS,
    targetKey: TOUR_TARGETS.TAB_PROFILE,
    title: 'Your settings',
    body: 'Accessibility, privacy and notifications live in Profile. Change them any time.',
  },
];

export const TOUR_STEPS = ALL_STEPS.map((step, i, arr) => ({ ...step, eyebrow: `${i + 1} OF ${arr.length}` }));
