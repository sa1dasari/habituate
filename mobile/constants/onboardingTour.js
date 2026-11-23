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
 * The tab route that renders SkylineScreen. In release builds the Skyline
 * tab is still the route named 'Today' (old TodayScreen until the rebuild's
 * swap); in __DEV__ SkylineScreen is the dev tab 'SkylineReal'. When App.js
 * points the 'Today' route at SkylineScreen, return 'Today' for both.
 */
export function getSkylineTabRoute(isDev) {
  return isDev ? 'SkylineReal' : 'Today';
}

export const SKYLINE_TAB_ROUTE = getSkylineTabRoute(typeof __DEV__ !== 'undefined' && __DEV__);

import { COMMUNITY_ENABLED } from './featureFlags';

// Eyebrow ("N OF total") is computed below rather than hardcoded, so the
// lean-v1 flag (no Community step) renumbers correctly without edits here.
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
  // Community step (SKYLINE.md Phase 8a): filtered out below, not deleted,
  // when COMMUNITY_ENABLED is false — the tab it spotlights doesn't exist
  // in that build, and this tour has no "skip if target missing" fallback.
  {
    id: 'community',
    scope: TOUR_SCOPES.TABS,
    targetKey: TOUR_TARGETS.TAB_COMMUNITY,
    title: 'Build with friends',
    body: 'Share a habit with friends, or raise a landmark together in Community.',
    requires: 'community',
  },
  {
    id: 'profile',
    scope: TOUR_SCOPES.TABS,
    targetKey: TOUR_TARGETS.TAB_PROFILE,
    title: 'Your settings',
    body: 'Accessibility, privacy and notifications live in Profile. Change them any time.',
  },
];

export const TOUR_STEPS = ALL_STEPS.filter(
  (step) => step.requires !== 'community' || COMMUNITY_ENABLED
).map((step, i, arr) => ({ ...step, eyebrow: `${i + 1} OF ${arr.length}` }));
