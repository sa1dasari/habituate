import React, { memo } from 'react';
import { Path } from 'react-native-svg';

/**
 * Paints one tower's shapes (a slice of utils/skylineScene.js's flat shape
 * list, already filtered to this tower's `towerId` by SkylineView). Memoized
 * so a re-render of the scene (e.g. one floor landing in Phase 2) doesn't
 * repaint every other tower — SKYLINE.md section 8's performance budget.
 */
function SkylineTower({ shapes }) {
  return shapes.map((s) => (
    <Path
      key={s.id}
      d={s.d}
      fill={s.fill}
      stroke={s.stroke}
      strokeWidth={s.strokeWidth}
      strokeDasharray={s.strokeDasharray}
      opacity={s.opacity}
    />
  ));
}

function propsAreEqual(prev, next) {
  return prev.shapes === next.shapes;
}

export default memo(SkylineTower, propsAreEqual);
