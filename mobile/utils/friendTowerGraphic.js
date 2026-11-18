/**
 * Pure layout for one friend-skyline tower silhouette (boards 43/44). No
 * React, no I/O — just turns the privacy-stripped FriendTower shape the
 * backend sends (color, floorCount, currentRun, closedSegmentFloorCounts;
 * see api/.../FriendProfileResponse.FriendTower) into window rows to draw.
 *
 * This is deliberately NOT utils/skylineScene.js's buildScene: that engine
 * needs real per-day check-in data (checkInDays, startDate) to classify each
 * floor, which the friend-skyline API never sends — only the two aggregate
 * numbers below. A friend's tower is a glanceable silhouette, not a precise
 * day-by-day history.
 */

// A friend tower is a small decorative silhouette next to several others in
// one row, not the full interactive skyline — capped much lower than
// skylineScene's own 35/60-floor ceiling so a long-running habit's tower
// doesn't dominate the row. Older floors beyond the cap fold into one solid
// block at the base, same "fold the old ones" idea as the real skyline's
// tiers, just without individual window detail.
export const MAX_VISIBLE_FLOORS = 14;

/**
 * @param {{ floorCount?: number, currentRun?: number }} tower
 * @returns {{ rows: { lit: boolean }[], foldedFloors: number }}
 *   `rows[0]` is the TOP (most recent) floor. Lit rows are the most recent
 *   ones within the current run, walking back from the top — the same rule
 *   skylineScene.js uses for the real skyline (it never recomputes the run
 *   from scratch; currentRun is taken as given).
 */
export function layoutFriendTower(tower) {
  const floorCount = Math.max(0, Math.floor(tower?.floorCount || 0));
  const currentRun = Math.max(0, Math.floor(tower?.currentRun || 0));
  const visibleFloors = Math.min(floorCount, MAX_VISIBLE_FLOORS);
  const foldedFloors = Math.max(0, floorCount - MAX_VISIBLE_FLOORS);
  const litVisibleFloors = Math.min(currentRun, visibleFloors);

  const rows = Array.from({ length: visibleFloors }, (_, i) => ({
    lit: i < litVisibleFloors,
  }));

  return { rows, foldedFloors };
}
