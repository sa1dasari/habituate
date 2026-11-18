/**
 * Pure layout for a Challenge's landmark tower (boards 09/11) — a tower
 * stacked from each contributor's own floor count, bottom to top, in
 * contribution order. The backend (ChallengeResponse.Participant.progress)
 * gives each member's total floors built, not which specific floor came
 * from whom, so contiguous colour bands (one per member, in participant
 * order) is the honest reading of that data — not a fabricated per-floor
 * interleaving this API was never asked to support.
 */

// Compact silhouette, same reasoning as utils/friendTowerGraphic.js's own
// cap — a landmark can run to 80+ floors on a long challenge, and this is a
// list-card/header illustration, not a precise floor-by-floor record (the
// "Who built what" bars on the detail page carry the real numbers).
export const MAX_VISIBLE_FLOORS = 24;
const LIT_TOP_COUNT = 4;

/**
 * @param {{ color: string, floors: number }[]} contributors - participant order
 * @returns {{ bands: { color: string, rowCount: number }[], totalRows: number, foldedFloors: number, litTopCount: number }}
 *   `bands` is bottom-to-top; the last band is nearest the top of the tower.
 */
export function layoutLandmarkTower(contributors) {
  const list = Array.isArray(contributors) ? contributors : [];
  const totalFloors = list.reduce((sum, c) => sum + Math.max(0, Math.floor(c?.floors || 0)), 0);
  const visibleTotal = Math.min(totalFloors, MAX_VISIBLE_FLOORS);
  const foldedFloors = Math.max(0, totalFloors - MAX_VISIBLE_FLOORS);

  // Scale every contributor's band down proportionally so the visible total
  // still matches `visibleTotal` when folding kicks in, rather than just
  // truncating the top contributor's band away first.
  const scale = totalFloors > 0 ? visibleTotal / totalFloors : 0;
  let allocated = 0;
  const bands = list
    .map((c, i) => {
      const raw = Math.max(0, Math.floor(c?.floors || 0));
      const isLast = i === list.length - 1;
      const rowCount = isLast ? Math.max(0, visibleTotal - allocated) : Math.round(raw * scale);
      allocated += rowCount;
      return { color: c?.color, rowCount };
    })
    .filter((b) => b.rowCount > 0);

  return {
    bands,
    totalRows: visibleTotal,
    foldedFloors,
    litTopCount: Math.min(LIT_TOP_COUNT, visibleTotal),
  };
}
