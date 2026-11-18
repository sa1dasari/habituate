import { layoutFriendTower, MAX_VISIBLE_FLOORS } from './friendTowerGraphic';

describe('layoutFriendTower', () => {
  it('lights the top N rows matching currentRun, oldest at the bottom', () => {
    const { rows, foldedFloors } = layoutFriendTower({ floorCount: 5, currentRun: 2 });
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.lit)).toEqual([true, true, false, false, false]);
    expect(foldedFloors).toBe(0);
  });

  it('caps visible rows at MAX_VISIBLE_FLOORS and folds the rest', () => {
    const { rows, foldedFloors } = layoutFriendTower({ floorCount: MAX_VISIBLE_FLOORS + 10, currentRun: 3 });
    expect(rows).toHaveLength(MAX_VISIBLE_FLOORS);
    expect(foldedFloors).toBe(10);
  });

  it('never lights more rows than are visible, even if currentRun is larger', () => {
    const { rows } = layoutFriendTower({ floorCount: 4, currentRun: 20 });
    expect(rows.every((r) => r.lit)).toBe(true);
    expect(rows).toHaveLength(4);
  });

  it('handles a brand new tower with no floors yet', () => {
    const { rows, foldedFloors } = layoutFriendTower({ floorCount: 0, currentRun: 0 });
    expect(rows).toHaveLength(0);
    expect(foldedFloors).toBe(0);
  });

  it('treats missing/negative input as zero rather than throwing', () => {
    expect(layoutFriendTower({}).rows).toHaveLength(0);
    expect(layoutFriendTower(undefined).rows).toHaveLength(0);
    expect(layoutFriendTower({ floorCount: -3, currentRun: -1 }).rows).toHaveLength(0);
  });
});
