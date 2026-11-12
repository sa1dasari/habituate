import { toDateKey } from './date';
import { hasDailyTarget } from './cadence';

/**
 * Pure scene builder for the skyline (SKYLINE.md section 8). No React, no
 * I/O, no clock reads — the caller passes `today`. Does not recompute
 * streaks or due-day rules from scratch: `currentRun`/`bestRun` are taken
 * as given inputs (SKYLINE.md section 4's rule), and day-by-day due/not-due
 * classification reuses `hasDailyTarget` from utils/cadence.js — the same
 * pure logic the rest of the app already uses for "is this a daily habit" —
 * rather than re-deriving a parallel notion of cadence here. A
 * weekly/monthly-target-only habit has no fixed per-day schedule in the
 * current data model (it can be done any day of its period), so for those
 * habits only logged days get a floor; every other day is "not due" and
 * draws nothing, matching section 4's floor-state table.
 */

// Geometry from SKYLINE.md section 8, validated in the Phase 0 spike.
export const VIEW_W = 390;
export const VIEW_H = 560;
export const BASE_Y = 500;
export const X0 = 14;
export const STEP = 52;
export const TOWER_W = 36;
export const DX = 10;
export const DY = -6;
export const FLOOR_H = 10;

// A tower draws at most ~60 floors total as a shape-count/performance
// ceiling (section 8/4) — but 59 individual floors at FLOOR_H=10 each is
// 590px tall, taller than BASE_Y itself (500), which draws the tower's
// upper floors above y=0, off the top of the scene entirely. A real habit
// old enough to approach the old cap surfaced this (towers visibly running
// past the available height, crowding the header/sky above them) — fixtures
// never lived long enough to hit it. 35 individual + 1 tier (older floors
// folded into it, same as before) + the crane/flag height above the top
// floor comfortably fits within BASE_Y with headroom for the sky above.
const MAX_INDIVIDUAL_FLOORS = 35;
const TIER_HEIGHT = FLOOR_H * 3;
const CRANE_HEIGHT = 38;
const DEFAULT_WINDOW_COUNT = 3;

/** Evenly spaced window x-fractions (0-1 across the floor width) for a given
 * count — an Accessibility setting (useWindowCount.js). n=3 reproduces the
 * [0.18, 0.5, 0.82] layout from
 * concept_screens/tower_floor_states_windows_and_shield.png exactly. */
function windowFractions(n) {
  if (n <= 1) return [0.5];
  const margin = 0.18;
  const span = 1 - margin * 2;
  return Array.from({ length: n }, (_, i) => margin + (span * i) / (n - 1));
}

function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

function dateRange(startKey, endKey) {
  const out = [];
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 20000) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return out;
}

function toKeySet(value) {
  if (!value) return new Set();
  return value instanceof Set ? value : new Set(value);
}

/**
 * Per-day floor state for one habit, oldest first, due days only (section
 * 4). Exported so TowerInsideView.js (Phase 3c's cross-section list) can
 * reuse the exact same set/open/glass classification the tower itself
 * draws from, instead of reimplementing it — the two must never disagree
 * about what a given day's floor looks like.
 */
export function classifyDays(habit, todayKey) {
  const checkInDays = toKeySet(habit.checkInDays);
  const shieldDays = toKeySet(habit.shieldDays);
  // habit.startDate is already a 'YYYY-MM-DD' day string per the section 8
  // input spec — do not round-trip it through `new Date()`/toDateKey, which
  // parses a bare date-only string as UTC midnight and can land on the
  // previous local day on a negative-UTC-offset machine (the same trap
  // utils/date.js's daysUntil works around for the same reason).
  const startKey = habit.startDate ? String(habit.startDate).slice(0, 10) : todayKey;
  const dailyHabit = hasDailyTarget(habit);

  const candidateDays = dailyHabit
    ? dateRange(startKey > todayKey ? todayKey : startKey, todayKey)
    : [...checkInDays].sort();

  return candidateDays
    .filter((day) => day >= startKey && day <= todayKey)
    .map((day) => {
      let state = 'open';
      if (checkInDays.has(day)) state = 'set';
      else if (shieldDays.has(day)) state = 'glass';
      return { day, state };
    });
}

function shade(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function floorFaces(x, yTop, width = TOWER_W) {
  const yBot = yTop + FLOOR_H;
  return {
    front: [
      [x, yTop],
      [x + width, yTop],
      [x + width, yBot],
      [x, yBot],
    ],
    right: [
      [x + width, yTop],
      [x + width + DX, yTop + DY],
      [x + width + DX, yBot + DY],
      [x + width, yBot],
    ],
    top: [
      [x, yTop],
      [x + DX, yTop + DY],
      [x + width + DX, yTop + DY],
      [x + width, yTop],
    ],
  };
}

function pointsToPath(pts) {
  return `M${pts.map((p) => p.join(',')).join('L')}Z`;
}

/**
 * Exposes one floor's three face paths, same geometry the engine itself
 * uses, so a "floor pours in" hold-gesture preview (SkylineHoldLayer.js)
 * draws the exact shape that will actually land — not a hand-drawn
 * approximation that could drift from it.
 */
export function previewFloorPaths(x, yTop, width = TOWER_W) {
  const faces = floorFaces(x, yTop, width);
  return {
    front: pointsToPath(faces.front),
    right: pointsToPath(faces.right),
    top: pointsToPath(faces.top),
  };
}

function faceShapes({
  id,
  x,
  yTop,
  width,
  color,
  state,
  theme,
  opacity = 1,
  runBand = false,
  windowCount = DEFAULT_WINDOW_COUNT,
}) {
  const faces = floorFaces(x, yTop, width);
  const shapes = [];

  if (state === 'glass') {
    // Shield Day: a flat, distinct-colored block — no windows at all. The
    // absence of windows (not a hatch texture) is the signal: a real
    // check-in always draws windows (lit or dark), a shielded day never
    // does. Matches concept_screens/tower_floor_states_windows_and_shield.png.
    shapes.push(
      { id: `${id}-front`, kind: 'path', d: pointsToPath(faces.front), fill: theme.shieldFill, opacity },
      { id: `${id}-right`, kind: 'path', d: pointsToPath(faces.right), fill: shade(theme.shieldFill, -20), opacity },
      { id: `${id}-top`, kind: 'path', d: pointsToPath(faces.top), fill: shade(theme.shieldFill, 20), opacity },
    );
    return shapes;
  }

  if (state === 'open') {
    // A transparent cutout, not a void: fill 'none' lets the sky behind the
    // tower show straight through, with a visible outline tracing the same
    // floor shape every other state uses. The floor's slot and outline stay
    // fully present — only its fill is missing — so it reads as "not built
    // yet, see-through" rather than a hole, crack or broken structure.
    shapes.push(
      { id: `${id}-front`, kind: 'path', d: pointsToPath(faces.front), fill: 'none', stroke: theme.openStroke, strokeWidth: 1, opacity },
      { id: `${id}-right`, kind: 'path', d: pointsToPath(faces.right), fill: 'none', stroke: theme.openStroke, strokeWidth: 1, opacity },
      { id: `${id}-top`, kind: 'path', d: pointsToPath(faces.top), fill: 'none', stroke: theme.openStroke, strokeWidth: 1, opacity },
    );
    return shapes;
  }

  // 'set' — wall color is the same whether this floor is in the current run
  // or not (concept_screens/tower_floor_states_windows_and_shield.png shows
  // identical block color for both); only the windows differ. Every real
  // check-in gets windows — lit (bright) inside the current run, dark
  // (muted) once the run has moved past it. That's the non-color signal:
  // windows present = a real check-in happened; shield (above) never has
  // any; run-band membership is color brightness on top of that.
  shapes.push(
    { id: `${id}-front`, kind: 'path', d: pointsToPath(faces.front), fill: color, opacity },
    { id: `${id}-right`, kind: 'path', d: pointsToPath(faces.right), fill: shade(color, -30), opacity },
    { id: `${id}-top`, kind: 'path', d: pointsToPath(faces.top), fill: shade(color, 30), opacity },
  );
  const windowColor = runBand ? theme.windowLit : theme.windowDark;
  const windowSize = 3;
  const wy = yTop + FLOOR_H / 2 - windowSize / 2;
  windowFractions(windowCount).forEach((frac, w) => {
    const wx = x + width * frac - windowSize / 2;
    shapes.push({
      id: `${id}-window${w}`,
      kind: 'path',
      d: `M${wx},${wy}h${windowSize}v${windowSize}h${-windowSize}Z`,
      fill: windowColor,
      opacity,
    });
  });
  return shapes;
}

function towerBodyShapes(habit, x, days, theme, windowCount) {
  const shapes = [];
  const visible = days.slice(-MAX_INDIVIDUAL_FLOORS);
  const hidden = days.slice(0, days.length - visible.length);

  let yCursor = BASE_Y;

  // Current run band (section 4): the trailing consecutive 'set' floors,
  // walking back from today, capped at habit.currentRun — stops at the
  // first non-'set' floor so an un-checked-in today doesn't break the
  // count of the streak that precedes it.
  const runBandIndices = new Set();
  if (habit.currentRun > 0) {
    for (let i = visible.length - 1; i >= 0 && runBandIndices.size < habit.currentRun; i -= 1) {
      if (visible[i].state !== 'set') break;
      runBandIndices.add(i);
    }
  }

  if (hidden.length > 0) {
    const yTop = yCursor - TIER_HEIGHT;
    const faces = floorFaces(x, yTop);
    shapes.push(
      { id: `${habit.id}-tier-front`, kind: 'path', d: pointsToPath(faces.front), fill: shade(habit.color, -10) },
      { id: `${habit.id}-tier-right`, kind: 'path', d: pointsToPath(faces.right), fill: shade(habit.color, -40) },
      { id: `${habit.id}-tier-top`, kind: 'path', d: pointsToPath(faces.top), fill: shade(habit.color, 20) },
      { id: `${habit.id}-tier-line`, kind: 'path', d: `M${x},${yTop + 3}L${x + TOWER_W},${yTop + 3}`, fill: 'none', stroke: theme.tierLine, strokeWidth: 1 },
    );
    yCursor = yTop;
  }

  visible.forEach(({ day, state }, i) => {
    const yTop = yCursor - FLOOR_H;
    const floor = faceShapes({
      id: `${habit.id}-f${i}`,
      x,
      yTop,
      width: TOWER_W,
      color: habit.color,
      state,
      theme,
      runBand: runBandIndices.has(i),
      windowCount,
    }).map((s) => ({ ...s, floorIndex: i }));
    shapes.push(...floor);
    yCursor = yTop;
  });

  return { shapes, topY: yCursor, visible, hidden };
}

function lifecycleShapes(habit, x, topY, theme) {
  const shapes = [];
  const cx = x + TOWER_W / 2;

  if (habit.state === 'monument') {
    // Grey overlay across the whole tower face reads clearly even at a
    // glance — applied as a semi-transparent rect rather than recoloring
    // every floor, so the category color underneath still identifies it.
    // The overlay alone is a color-only signal though, so it gets a
    // cross-hatch texture on top (distinct from glass's single diagonal) —
    // section 13 requires every state to read in grayscale, not just color.
    const overlayTop = floorFaces(x, topY, TOWER_W).front.concat([[x, BASE_Y]]);
    shapes.push({
      id: `${habit.id}-monument-overlay`,
      kind: 'path',
      d: pointsToPath(overlayTop),
      fill: theme.monumentOverlay,
    });
    let hatchPath = '';
    for (let y = topY + 6; y < BASE_Y; y += 10) {
      hatchPath += `M${x},${Math.min(y + 6, BASE_Y)}L${x + TOWER_W},${y}`;
    }
    shapes.push({
      id: `${habit.id}-monument-hatch`,
      kind: 'path',
      d: hatchPath,
      fill: 'none',
      stroke: theme.craneColor,
      strokeWidth: 1,
    });
    return shapes;
  }

  if (habit.state === 'topped_out') {
    shapes.push({
      id: `${habit.id}-flag`,
      kind: 'path',
      d: `M${cx},${topY - 18}L${cx},${topY}M${cx},${topY - 18}L${cx + 10},${topY - 14}L${cx},${topY - 10}Z`,
      fill: theme.flagColor,
      stroke: theme.flagColor,
      strokeWidth: 1.5,
    });
    return shapes;
  }

  // active: crane mast + short jib
  const mastTop = topY - CRANE_HEIGHT;
  shapes.push({
    id: `${habit.id}-crane`,
    kind: 'path',
    d: `M${cx},${topY}L${cx},${mastTop}L${cx + 14},${mastTop + 4}`,
    fill: 'none',
    stroke: theme.craneColor,
    strokeWidth: 1.5,
  });
  return shapes;
}

function bestRunLedge(habit, x, days, visible, topY, theme) {
  if (!habit.bestRun || !habit.bestRun.endDate) return [];
  // Same day-string rule as startDate above — no Date round-trip.
  const endKey = String(habit.bestRun.endDate).slice(0, 10);
  const visibleIndex = visible.findIndex((d) => d.day === endKey);

  let ledgeY;
  if (visibleIndex >= 0) {
    // visible[] is oldest-last appended going up, so its screen position
    // was computed top-down in towerBodyShapes — recompute the same way.
    ledgeY = BASE_Y - (days.length > visible.length ? TIER_HEIGHT : 0) - (visible.length - visibleIndex) * FLOOR_H;
  } else if (endKey < (visible[0] && visible[0].day)) {
    // best run ends inside the collapsed tier — ledge sits at the tier top.
    ledgeY = topY + (days.length > visible.length ? 0 : -TIER_HEIGHT);
  } else {
    return [];
  }

  return [
    {
      id: `${habit.id}-ledge`,
      kind: 'path',
      d: `M${x - 1},${ledgeY}L${x + TOWER_W + DX + 1},${ledgeY + DY}`,
      fill: 'none',
      stroke: theme.ledgeColor,
      strokeWidth: 2,
    },
  ];
}

function accessibilityLabel(habit, days) {
  const last14 = days.slice(-14);
  const setCount = last14.filter((d) => d.state === 'set').length;
  const runWord = habit.currentRun === 1 ? 'day' : 'days';
  return `${habit.name}, ${setCount} of the last ${last14.length} days set, ${habit.currentRun} ${runWord} run`;
}

/**
 * @param {Array} habits - see SKYLINE.md section 8 for the full input shape.
 * @param {{ today: Date, theme: object, windowCount?: number, reduceMotion?: boolean }} options
 */
export function buildScene(habits, options) {
  const { today, theme, windowCount = DEFAULT_WINDOW_COUNT } = options;
  const todayKey = toDateKey(today);

  const shapes = [];
  const hitTargets = [];
  const accessibilityLabels = {};

  (habits || []).forEach((habit, index) => {
    const x = X0 + index * STEP;
    const days = classifyDays(habit, todayKey);
    const { shapes: bodyShapes, topY, visible, hidden } = towerBodyShapes(habit, x, days, theme, windowCount);

    const towerShapes = [
      ...bodyShapes,
      ...lifecycleShapes(habit, x, topY, theme),
      ...bestRunLedge(habit, x, days, visible, topY, theme),
    ].map((s) => ({ towerId: habit.id, floorIndex: null, ...s }));
    shapes.push(...towerShapes);

    const towerTop = habit.state === 'active' ? topY - CRANE_HEIGHT : topY - 20;
    hitTargets.push({
      towerId: habit.id,
      x,
      y: towerTop,
      width: TOWER_W + DX,
      height: BASE_Y - towerTop,
      // Where a newly-built floor's bottom edge sits — i.e. the top of the
      // topmost existing floor/tier. Used by the hold gesture's "floor
      // pours in" preview (SkylineHoldLayer.js) to draw the incoming floor
      // in the right place without recomputing tower layout itself.
      nextFloorY: topY,
    });
    accessibilityLabels[habit.id] = accessibilityLabel(habit, days);
    void hidden; // reserved for a future "N days folded in" accessibility note
  });

  const sceneWidth = X0 * 2 + Math.max(habits.length, 1) * STEP;

  return { shapes, hitTargets, accessibilityLabels, width: sceneWidth, height: VIEW_H };
}
