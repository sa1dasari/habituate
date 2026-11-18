import React from 'react';
import Svg, { Polygon, Rect } from 'react-native-svg';
import { layoutLandmarkTower } from '../utils/landmarkTowerGraphic';

const TOWER_W = 30;
const DX = 8;
const DY = -5;
const FLOOR_H = 6;
const FOLD_UNIT_H = 0.3;
const MAX_FOLD_H = 40;
const WINDOW_FRACTIONS = [0.2, 0.5, 0.8];

function shade(hex, amount) {
  const n = parseInt(String(hex || '#8B95A5').replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function toPointsAttr(pts) {
  return pts.map((p) => p.join(',')).join(' ');
}

/**
 * Boards 09/11: a Challenge's landmark — one tower stacked from contiguous
 * per-contributor colour bands (see utils/landmarkTowerGraphic.js for why
 * bands, not a true per-floor interleave), gold cap, the top few floors lit
 * to read as "actively being built" (no per-floor timestamp exists to know
 * exactly which floors are recent, so this is a fixed decorative count, not
 * a precise "current run" the way a personal tower's lit floors are).
 * `contributors` is `[{ color, floors }]` in participant order (bottom to
 * top); `towerTheme` is skylineTowerTheme.dark — always dark, same reasoning
 * as FriendTowerGraphic/MemberTowerRow.
 */
export default function LandmarkTowerGraphic({ contributors, towerTheme, width = 70, height = 150, testID }) {
  const { bands, totalRows, foldedFloors, litTopCount } = layoutLandmarkTower(contributors);
  const foldHeight = foldedFloors > 0 ? Math.min(MAX_FOLD_H, foldedFloors * FOLD_UNIT_H) : 0;
  const bodyH = totalRows * FLOOR_H + foldHeight;
  const mainX = (width - TOWER_W) / 2;
  const baseY = height - 4;
  const topY = baseY - bodyH;

  const sidePts = [
    [mainX + TOWER_W, topY],
    [mainX + TOWER_W + DX, topY + DY],
    [mainX + TOWER_W + DX, baseY + DY],
    [mainX + TOWER_W, baseY],
  ];
  const capPts = [
    [mainX, topY],
    [mainX + DX, topY + DY],
    [mainX + TOWER_W + DX, topY + DY],
    [mainX + TOWER_W, topY],
  ];

  // Rows are built top-down (row 0 = top = most recently stacked band) since
  // bands are given bottom-to-top and the lit count counts from the top.
  const rowColors = [];
  bands.forEach((band) => {
    for (let i = 0; i < band.rowCount; i += 1) rowColors.push(band.color);
  });
  rowColors.reverse();

  const windows = [];
  const stripes = [];
  rowColors.forEach((color, i) => {
    const rowTop = topY + foldHeight + i * FLOOR_H;
    const lit = i < litTopCount;
    stripes.push(<Rect key={`row-${i}`} x={mainX} y={rowTop} width={TOWER_W} height={FLOOR_H} fill={color} />);
    const windowColor = lit ? towerTheme.windowLit : shade(color, -45);
    WINDOW_FRACTIONS.forEach((frac) => {
      windows.push(
        <Rect
          key={`win-${i}-${frac}`}
          x={mainX + TOWER_W * frac - 1.3}
          y={rowTop + FLOOR_H / 2 - 1.3}
          width={2.6}
          height={2.6}
          rx={0.6}
          fill={windowColor}
        />,
      );
    });
  });

  const totalFloors = (contributors || []).reduce((sum, c) => sum + Math.max(0, Math.floor(c?.floors || 0)), 0);
  const accessibilityLabel = `Landmark, ${totalFloors} floors built`;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
    >
      {foldHeight > 0 ? (
        <Rect x={mainX} y={baseY - foldHeight} width={TOWER_W} height={foldHeight} fill={shade(rowColors[0] || '#8B95A5', -20)} />
      ) : null}
      {stripes}
      <Polygon points={toPointsAttr(sidePts)} fill={shade(rowColors[rowColors.length - 1] || '#8B95A5', -30)} />
      <Polygon points={toPointsAttr(capPts)} fill={towerTheme.flagColor} />
      {windows}
    </Svg>
  );
}
