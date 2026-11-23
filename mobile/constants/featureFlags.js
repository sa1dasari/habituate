/**
 * Lean v1 launch flags (SKYLINE.md Phase 8a, section 14 #21). Community,
 * Challenges and the AI coach are fully built but held back for the v1
 * build rather than deleted — flip these back to true to re-enable them
 * for v2.
 *
 * COMMUNITY_ENABLED: the Community tab itself always stays in the tab bar
 * (revised 2026-11-23, owner decision) — false just swaps its screen for
 * CommunityComingSoonScreen (App.js) instead of removing the tab.
 * COACH_ENABLED: unlike Community, false removes the coach entry points
 * outright (TodayScreen.js) rather than showing a stand-in.
 */
export const COMMUNITY_ENABLED = false;
export const COACH_ENABLED = false;
