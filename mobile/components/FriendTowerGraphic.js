import React from 'react';
import Svg, { Polygon, Rect } from 'react-native-svg';
import { layoutFriendTower } from '../utils/friendTowerGraphic';
import { towerColorHex } from '../constants/towerColors';

// Compact geometry for a small silhouette sitting in a row next to several
// others (boards 43/44) — not utils/skylineScene.js's full-size VIEW_W/H
// constants, which are sized for one tower filling most of the screen.
const TOWER_W = 30;
const DX = 8;
const DY = -5;
const FLOOR_H = 7;
// Folded (beyond MAX_VISIBLE_FLOORS) floors still add height, just
// compressed, so an established habit's tower visibly reads taller than a
// brand new one instead of flattening out at the cap — board 43's whole
// point is a magnitude silhouette.
const FOLD_UNIT_H = 0.5;
const MAX_FOLD_H = 50;
const GHOST_OFFSET_X = 14;
const GHOST_OFFSET_Y = 7;
const GHOST_MAX_FLOORS = 8;
// Same 3-window-per-floor layout design/skyline/22-floor-states-reference.png
// established and utils/skylineScene.js's default uses — the
// useWindowCount.js Accessibility setting is the viewer's own preference for
// their own skyline and isn't wired here, since a friend tower carries no
// per-day detail for a count setting to act on anyway.
const WINDOW_FRACTIONS = [0.2, 0.5, 0.8];

function shade(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function toPointsAttr(pts) {
  return pts.map((p) => p.join(',')).join(' ');
}

/** One tower body: front rect (+ window pips), skewed side face, skewed cap.
 * `baseY` is where the tower's bottom sits; the body grows upward from it. */
function TowerBody({ x, baseY, color, rowCount, litCount, foldHeight, towerTheme, ghost }) {
  const bodyH = rowCount * FLOOR_H + foldHeight;
  const topY = baseY - bodyH;
  const frontColor = ghost ? towerTheme.closedSegmentFill : color;
  const sideColor = shade(frontColor, -30);
  const capColor = ghost ? towerTheme.flagColor : shade(frontColor, 30);

  const sidePts = [
    [x + TOWER_W, topY],
    [x + TOWER_W + DX, topY + DY],
    [x + TOWER_W + DX, baseY + DY],
    [x + TOWER_W, baseY],
  ];
  const capPts = [
    [x, topY],
    [x + DX, topY + DY],
    [x + TOWER_W + DX, topY + DY],
    [x + TOWER_W, topY],
  ];

  const windows = [];
  if (bodyH > 0) {
    for (let i = 0; i < rowCount; i += 1) {
      const rowTop = topY + i * FLOOR_H;
      const lit = !ghost && i < litCount;
      const windowColor = lit ? towerTheme.windowLit : ghost ? shade(frontColor, -45) : towerTheme.windowDark;
      WINDOW_FRACTIONS.forEach((frac) => {
        windows.push(
          <Rect
            key={`${x}-${i}-${frac}`}
            x={x + TOWER_W * frac - 1.5}
            y={rowTop + FLOOR_H / 2 - 1.5}
            width={3}
            height={3}
            rx={0.8}
            fill={windowColor}
          />,
        );
      });
    }
  }

  return (
    <>
      <Rect x={x} y={topY} width={TOWER_W} height={bodyH} fill={frontColor} />
      <Polygon points={toPointsAttr(sidePts)} fill={sideColor} />
      <Polygon points={toPointsAttr(capPts)} fill={capColor} />
      {windows}
      {ghost && (
        <Rect
          x={x + TOWER_W * 0.42}
          y={topY + DY - 7}
          width={2}
          height={9}
          fill={towerTheme.craneColor}
        />
      )}
      {ghost && (
        <Polygon
          points={toPointsAttr([
            [x + TOWER_W * 0.42 + 2, topY + DY - 7],
            [x + TOWER_W * 0.42 + 8, topY + DY - 5],
            [x + TOWER_W * 0.42 + 2, topY + DY - 3],
          ])}
          fill={towerTheme.flagColor}
        />
      )}
    </>
  );
}

/**
 * One friend tower, drawn from only the aggregate FriendTower shape the
 * friend-skyline API sends — no name, no per-day history. `tower` is a
 * FriendTower (color/floorCount/currentRun/closedSegmentFloorCounts);
 * `mode` is 'dark' | 'light'; `towerTheme` is skylineTowerTheme[mode].
 * `height` fixes the silhouette's baseline so a row of towers with
 * different floor counts all sit on the same ground line. `testID` is
 * required — board 43/44 are a row of otherwise-identical towers, each one
 * needs its own stable id and a numeric (not name-carrying) accessibility
 * label, per CLAUDE.md's "every tower gets a testID and accessibility
 * label" rule.
 */
export default function FriendTowerGraphic({ tower, mode, towerTheme, width = 70, height = 150, testID }) {
  const { rows, foldedFloors } = layoutFriendTower(tower);
  const litCount = rows.filter((r) => r.lit).length;
  const color = towerColorHex(tower?.color, mode) || towerColorHex('slate', mode);
  const foldHeight = foldedFloors > 0 ? Math.min(MAX_FOLD_H, foldedFloors * FOLD_UNIT_H) : 0;
  const baseY = height - 4;

  const lastGhostFloors = tower?.closedSegmentFloorCounts?.length
    ? tower.closedSegmentFloorCounts[tower.closedSegmentFloorCounts.length - 1]
    : 0;
  const ghostRowCount = Math.min(Math.max(0, lastGhostFloors), GHOST_MAX_FLOORS);

  // Centered, not right-aligned: a ghost tower folds back-left of it, and
  // (board 44) a skybridge line needs to land on this tower's center from
  // either side of the pair.
  const mainX = (width - TOWER_W) / 2;

  const floorCount = Math.max(0, Math.floor(tower?.floorCount || 0));
  const currentRun = Math.max(0, Math.floor(tower?.currentRun || 0));
  const runWord = currentRun === 1 ? 'day' : 'days';
  const accessibilityLabel = `Tower, ${floorCount} floors, ${currentRun} ${runWord} run`;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {ghostRowCount > 0 && (
        <TowerBody
          x={mainX - GHOST_OFFSET_X}
          baseY={baseY - GHOST_OFFSET_Y}
          color={color}
          rowCount={ghostRowCount}
          litCount={0}
          foldHeight={0}
          towerTheme={towerTheme}
          ghost
        />
      )}
      <TowerBody
        x={mainX}
        baseY={baseY}
        color={color}
        rowCount={rows.length}
        litCount={litCount}
        foldHeight={foldHeight}
        towerTheme={towerTheme}
        ghost={false}
      />
    </Svg>
  );
}
