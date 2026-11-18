const { buildScene, X0, STEP, BASE_Y } = require('./skylineScene');

const theme = {
  openStroke: '#999',
  shieldFill: '#abc',
  shieldFillSide: '#9ab',
  shieldEdge: '#def',
  shieldIcon: '#fff',
  windowLit: '#ffe',
  windowDark: '#642',
  tierLine: '#333',
  monumentOverlay: 'rgba(0,0,0,0.5)',
  craneColor: '#444',
  flagColor: '#f00',
  ledgeColor: '#fff',
  closedSegmentFill: '#765',
};

const TODAY = new Date('2026-11-07T12:00:00');

function dailyHabit(overrides = {}) {
  return {
    id: 'h1',
    name: 'Test habit',
    category: 'Fitness',
    color: '#ff8a5b',
    cadenceType: 'DAILY',
    cadenceTarget: 1,
    trackingMode: 'BOOLEAN',
    startDate: '2026-11-01',
    checkInDays: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06', '2026-11-07'],
    shieldDays: [],
    currentRun: 2,
    bestRun: { length: 3, startDate: '2026-11-01', endDate: '2026-11-03' },
    state: 'active',
    ...overrides,
  };
}

describe('buildScene', () => {
  test('returns shapes, hit targets, and an accessibility label per tower', () => {
    const scene = buildScene([dailyHabit()], { today: TODAY, theme });
    expect(scene.shapes.length).toBeGreaterThan(0);
    expect(scene.hitTargets).toHaveLength(1);
    expect(scene.hitTargets[0].towerId).toBe('h1');
    expect(scene.accessibilityLabels.h1).toMatch(/Test habit/);
  });

  test('places towers left to right at the fixed step', () => {
    const scene = buildScene([dailyHabit({ id: 'a' }), dailyHabit({ id: 'b' })], { today: TODAY, theme });
    expect(scene.hitTargets[0].x).toBe(X0);
    expect(scene.hitTargets[1].x).toBe(X0 + STEP);
  });

  test('a daily habit draws one due-day floor for every day from start to today, skipped days become open', () => {
    // 2026-11-01..07 = 7 due days; 11-04 has no check-in -> open.
    const scene = buildScene([dailyHabit()], { today: TODAY, theme });
    const openShapes = scene.shapes.filter((s) => s.id.includes('f3-front')); // index 3 = 11-04
    expect(openShapes).toHaveLength(1);
    expect(openShapes[0].fill).toBe('none');
    expect(openShapes[0].stroke).toBe(theme.openStroke);
  });

  test('an open floor has no windows', () => {
    const scene = buildScene([dailyHabit()], { today: TODAY, theme });
    const openWindows = scene.shapes.filter((s) => s.id.startsWith('h1-f3-window'));
    expect(openWindows).toHaveLength(0);
  });

  test('a shielded day renders as a glass-tinted translucent block with a bright edge, no windows, not open or set', () => {
    const habit = dailyHabit({ shieldDays: ['2026-11-04'], checkInDays: ['2026-11-01'] });
    const scene = buildScene([habit], { today: TODAY, theme });
    const front = scene.shapes.find((s) => s.id === 'h1-f3-front');
    expect(front.fill).toBe(theme.shieldFill);
    expect(front.opacity).toBeLessThan(1); // glass, not an opaque solid block
    expect(front.stroke).toBe(theme.shieldEdge);
    const side = scene.shapes.find((s) => s.id === 'h1-f3-right');
    expect(side.fill).toBe(theme.shieldFillSide);
    // No icon here — the main tower's floors aren't tall enough to fit one
    // legibly (design-review board 22); only LotTile.js/TowerInsideView.js
    // (much bigger renderings) show it.
    expect(scene.shapes.find((s) => s.id === 'h1-f3-shield-icon')).toBeUndefined();
    const windows = scene.shapes.filter((s) => s.id.startsWith('h1-f3-window'));
    expect(windows).toHaveLength(0);
  });

  test('every set floor gets windows — lit inside the run band, dark once past it', () => {
    // dailyHabit(): currentRun 2, set on 11-01,02,03,05,06,07 -> run band is
    // the trailing 2 set floors (11-06, 11-07 = indices 5 and 6).
    const scene = buildScene([dailyHabit()], { today: TODAY, theme });
    const litWindow = scene.shapes.find((s) => s.id === 'h1-f6-window0'); // 11-07, in run band
    const darkWindow = scene.shapes.find((s) => s.id === 'h1-f0-window0'); // 11-01, not in run band
    expect(litWindow.fill).toBe(theme.windowLit);
    expect(darkWindow.fill).toBe(theme.windowDark);
  });

  test('wall color is identical for lit and dark window floors — only the windows differ', () => {
    const scene = buildScene([dailyHabit()], { today: TODAY, theme });
    const litFloorFront = scene.shapes.find((s) => s.id === 'h1-f6-front');
    const darkFloorFront = scene.shapes.find((s) => s.id === 'h1-f0-front');
    expect(litFloorFront.fill).toBe(darkFloorFront.fill);
  });

  test('windowCount option controls how many windows each set floor gets', () => {
    const scene2 = buildScene([dailyHabit()], { today: TODAY, theme, windowCount: 2 });
    const scene5 = buildScene([dailyHabit()], { today: TODAY, theme, windowCount: 5 });
    expect(scene2.shapes.filter((s) => s.id.startsWith('h1-f0-window'))).toHaveLength(2);
    expect(scene5.shapes.filter((s) => s.id.startsWith('h1-f0-window'))).toHaveLength(5);
  });

  test('windowCount defaults to 3 when not given', () => {
    const scene = buildScene([dailyHabit()], { today: TODAY, theme });
    expect(scene.shapes.filter((s) => s.id.startsWith('h1-f0-window'))).toHaveLength(3);
  });

  test('a weekly-target-only habit only gets floors on logged days, not every calendar day', () => {
    const habit = dailyHabit({
      cadenceType: 'WEEKLY',
      weeklyTarget: 3,
      cadenceTarget: undefined,
      checkInDays: ['2026-11-02', '2026-11-05'],
    });
    const scene = buildScene([habit], { today: TODAY, theme });
    // Only 2 due days -> at most 2 individual floor groups (6 shapes: 3 faces x 2).
    const floorFronts = scene.shapes.filter((s) => /h1-f\d+-front$/.test(s.id));
    expect(floorFronts).toHaveLength(2);
  });

  test('monument state draws an overlay instead of a crane or flag', () => {
    const habit = dailyHabit({ state: 'monument' });
    const scene = buildScene([habit], { today: TODAY, theme });
    expect(scene.shapes.find((s) => s.id === 'h1-monument-overlay')).toBeTruthy();
    expect(scene.shapes.find((s) => s.id === 'h1-crane')).toBeFalsy();
    expect(scene.shapes.find((s) => s.id === 'h1-flag')).toBeFalsy();
  });

  test('topped_out state draws a flag, not a crane', () => {
    const habit = dailyHabit({ state: 'topped_out' });
    const scene = buildScene([habit], { today: TODAY, theme });
    expect(scene.shapes.find((s) => s.id === 'h1-flag')).toBeTruthy();
    expect(scene.shapes.find((s) => s.id === 'h1-crane')).toBeFalsy();
  });

  test('active state draws a crane, not a flag or monument overlay', () => {
    const scene = buildScene([dailyHabit()], { today: TODAY, theme });
    expect(scene.shapes.find((s) => s.id === 'h1-crane')).toBeTruthy();
    expect(scene.shapes.find((s) => s.id === 'h1-flag')).toBeFalsy();
  });

  test('a tower older than the individual-floor cap collapses older floors into one tier', () => {
    const start = new Date('2026-11-01T00:00:00');
    start.setDate(start.getDate() - 90); // ~90 due days, well over the individual-floor cap
    const checkInDays = [];
    for (let i = 0; i < 90; i += 1) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      checkInDays.push(d.toISOString().slice(0, 10));
    }
    const habit = dailyHabit({
      startDate: start.toISOString().slice(0, 10),
      checkInDays,
    });
    const scene = buildScene([habit], { today: TODAY, theme });
    expect(scene.shapes.find((s) => s.id === 'h1-tier-front')).toBeTruthy();
    expect(scene.shapes.find((s) => s.id === 'h1-tier-line')).toBeTruthy();
  });

  test('floors never go below the base line regardless of habit count', () => {
    const scene = buildScene([dailyHabit({ id: 'a' }), dailyHabit({ id: 'b' })], { today: TODAY, theme });
    scene.shapes.forEach((s) => {
      if (s.kind !== 'path' || !s.d) return;
      const ys = [...s.d.matchAll(/,(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
      ys.forEach((y) => expect(y).toBeLessThanOrEqual(BASE_Y + 1));
    });
  });

  test('handles an empty habit list without throwing', () => {
    expect(() => buildScene([], { today: TODAY, theme })).not.toThrow();
  });
});

describe('buildScene — Phase 3d closed-segment compositing', () => {
  test('a habit with no closedSegments renders exactly as before this phase', () => {
    const withField = buildScene([dailyHabit({ closedSegments: [] })], { today: TODAY, theme });
    const withoutField = buildScene([dailyHabit()], { today: TODAY, theme });
    expect(withField.shapes).toEqual(withoutField.shapes);
    expect(withField.hitTargets).toEqual(withoutField.hitTargets);
  });

  describe('a finished tower keeps the height it reached (boards 20/21)', () => {
    const closedTopY = (floorCount) => {
      const scene = buildScene([dailyHabit({ closedSegments: [{ floorCount, bestRun: 1 }] })], { today: TODAY, theme });
      const front = scene.shapes.find((sh) => sh.id === 'h1-closed0-front');
      // front face path: "Mx,y L..." — the first point's y is the tower top.
      return Number(front.d.match(/^M[-\d.]+,([-\d.]+)/)[1]);
    };

    test('a taller finished tower reaches higher', () => {
      expect(closedTopY(30)).toBeLessThan(closedTopY(12));
      expect(closedTopY(12)).toBeLessThan(closedTopY(4));
    });

    test('is capped like the live tower, so it never outgrows the scene', () => {
      expect(closedTopY(500)).toBeGreaterThanOrEqual(0);
      expect(closedTopY(500)).toBeLessThan(closedTopY(35));
      expect(closedTopY(200)).toBe(closedTopY(500));
    });

    test('costs a fixed handful of shapes however tall it is', () => {
      const count = (floorCount) =>
        buildScene([dailyHabit({ closedSegments: [{ floorCount, bestRun: 1 }] })], { today: TODAY, theme }).shapes.filter(
          (sh) => sh.id.startsWith('h1-closed0-'),
        ).length;
      expect(count(5)).toBe(count(300));
      expect(count(300)).toBeLessThanOrEqual(7);
    });

    test('the body fills the whole tower height, not just the top floor', () => {
      const scene = buildScene([dailyHabit({ closedSegments: [{ floorCount: 12, bestRun: 9 }] })], { today: TODAY, theme });
      const front = scene.shapes.find((sh) => sh.id === 'h1-closed0-front');
      const ys = [...front.d.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
      expect(Math.max(...ys)).toBe(BASE_Y);
      expect(BASE_Y - Math.min(...ys)).toBe(12 * 10);
    });

    test('has all-dark windows and a gold cap with a flag', () => {
      const scene = buildScene([dailyHabit({ closedSegments: [{ floorCount: 12, bestRun: 9 }] })], { today: TODAY, theme });
      const byId = (id) => scene.shapes.find((sh) => sh.id === id);
      // Windows are a darker shade of the wall, never the lit window colour.
      expect(byId('h1-closed0-windows').fill).not.toBe(byId('h1-closed0-front').fill);
      expect(byId('h1-closed0-windows').fill).not.toBe(theme.windowLit);
      expect(byId('h1-closed0-top').fill).toBe(theme.flagColor);
      expect(byId('h1-closed0-flag')).toBeTruthy();
    });
  });

  test('a closed segment adds faded shapes but never a second hit target', () => {
    const habit = dailyHabit({ closedSegments: [{ floorCount: 12, bestRun: 9 }] });
    const scene = buildScene([habit], { today: TODAY, theme });

    expect(scene.hitTargets).toHaveLength(1);
    expect(scene.hitTargets[0].towerId).toBe('h1');
    const closedShapes = scene.shapes.filter((s) => s.id.startsWith('h1-closed0-'));
    expect(closedShapes.length).toBeGreaterThan(0);
    closedShapes.forEach((s) => expect(s.opacity).toBeLessThan(1));
  });

  test('up to two closed segments render, oldest furthest back', () => {
    const habit = dailyHabit({
      closedSegments: [
        { floorCount: 30, bestRun: 20 },
        { floorCount: 5, bestRun: 5 },
      ],
    });
    const scene = buildScene([habit], { today: TODAY, theme });

    const olderFront = scene.shapes.find((s) => s.id === 'h1-closed0-front');
    const recentFront = scene.shapes.find((s) => s.id === 'h1-closed1-front');
    expect(olderFront).toBeTruthy();
    expect(recentFront).toBeTruthy();
    // Both faces come from the same `floorFaces` shape, so their first
    // coordinate pair is the shape's own x — the older segment's x is
    // further left (smaller) than the more recently closed one's.
    const xOf = (d) => Number(d.slice(1).split(',')[0]);
    expect(xOf(olderFront.d)).toBeLessThan(xOf(recentFront.d));
    expect(scene.hitTargets).toHaveLength(1);
  });

  test('closed segments on one tower never spill into a neighboring tower\'s slot', () => {
    const scene = buildScene(
      [
        dailyHabit({
          id: 'a',
          closedSegments: [
            { floorCount: 30, bestRun: 20 },
            { floorCount: 5, bestRun: 5 },
          ],
        }),
        dailyHabit({ id: 'b' }),
      ],
      { today: TODAY, theme },
    );

    const aShapes = scene.shapes.filter((s) => s.towerId === 'a' && s.kind === 'path' && s.d);
    aShapes.forEach((s) => {
      const xs = [...s.d.matchAll(/(-?\d+(?:\.\d+)?),-?\d+(?:\.\d+)?/g)].map((m) => Number(m[1]));
      xs.forEach((xVal) => {
        expect(xVal).toBeGreaterThanOrEqual(0);
        // STEP is habit b's own x — habit a's shapes (including its faded
        // closed segments) must never reach into that slot.
        expect(xVal).toBeLessThan(X0 + STEP);
      });
    });
  });
});

describe('classifyDays day-range', () => {
  const { classifyDays } = require('./skylineScene');
  const habit = (overrides = {}) => ({
    id: 'r',
    cadenceType: 'DAILY',
    cadenceTarget: 1,
    startDate: '2026-10-01',
    checkInDays: ['2026-10-02', '2026-10-05', '2026-10-20'],
    shieldDays: [],
    ...overrides,
  });

  test('no range behaves the same as calling without one', () => {
    const withRange = classifyDays(habit(), '2026-10-10', undefined);
    const noArg = classifyDays(habit(), '2026-10-10');
    expect(withRange).toEqual(noArg);
    expect(withRange[0].day).toBe('2026-10-01');
    expect(withRange[withRange.length - 1].day).toBe('2026-10-10');
  });

  test('a range inside the history returns only those days', () => {
    const days = classifyDays(habit(), '2026-10-31', { fromKey: '2026-10-03', toKey: '2026-10-06' });
    expect(days.map((d) => d.day)).toEqual(['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']);
    expect(days.find((d) => d.day === '2026-10-05').state).toBe('set');
  });

  test('a range starting before the habit existed clips to its own startDate', () => {
    const days = classifyDays(habit(), '2026-10-31', { fromKey: '2026-09-01', toKey: '2026-10-03' });
    expect(days[0].day).toBe('2026-10-01');
    expect(days[days.length - 1].day).toBe('2026-10-03');
  });

  test('a range ending after today clips to todayKey', () => {
    const days = classifyDays(habit(), '2026-10-10', { fromKey: '2026-10-08', toKey: '2026-12-31' });
    expect(days[days.length - 1].day).toBe('2026-10-10');
  });
});

describe('finishedTowerIllustration', () => {
  const { finishedTowerIllustration } = require('./skylineScene');

  test('reports a positive width/height and a non-empty path for every shape', () => {
    const { shapes, width, height } = finishedTowerIllustration(26, '#8a5', theme);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(shapes.length).toBeGreaterThan(0);
    shapes.forEach((s) => expect(s.d.length).toBeGreaterThan(0));
  });

  test('windows are always dark (shaded fill), never the lit color — a finished tower is past its run', () => {
    const { shapes } = finishedTowerIllustration(10, '#8a5', theme);
    const windows = shapes.find((s) => s.id.endsWith('-windows'));
    expect(windows.fill).not.toBe('#8a5');
  });

  test('a short run still draws the minimum floor count, not zero', () => {
    const short = finishedTowerIllustration(1, '#8a5', theme);
    const zero = finishedTowerIllustration(0, '#8a5', theme);
    expect(short.height).toBe(zero.height);
  });

  test('falls back to the theme closed-segment fill when no color is given', () => {
    const { shapes } = finishedTowerIllustration(5, null, theme);
    const front = shapes.find((s) => s.id.endsWith('-front'));
    expect(front.fill).toBe(theme.closedSegmentFill);
  });
});
