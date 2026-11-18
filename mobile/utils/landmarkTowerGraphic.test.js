import { layoutLandmarkTower, MAX_VISIBLE_FLOORS } from './landmarkTowerGraphic';

describe('layoutLandmarkTower', () => {
  it('stacks contributors bottom-to-top in participant order, totals matching, when under the cap', () => {
    const { bands, totalRows, foldedFloors } = layoutLandmarkTower([
      { color: '#1', floors: 8 },
      { color: '#2', floors: 6 },
      { color: '#3', floors: 4 },
      { color: '#4', floors: 2 },
    ]);
    expect(totalRows).toBe(20);
    expect(foldedFloors).toBe(0);
    expect(bands.map((b) => b.rowCount)).toEqual([8, 6, 4, 2]);
  });

  it('scales every band down proportionally when the total exceeds the visible cap', () => {
    const { bands, totalRows, foldedFloors } = layoutLandmarkTower([
      { color: '#1', floors: 60 },
      { color: '#2', floors: 40 },
    ]);
    expect(totalRows).toBe(MAX_VISIBLE_FLOORS);
    expect(foldedFloors).toBe(100 - MAX_VISIBLE_FLOORS);
    expect(bands.reduce((sum, b) => sum + b.rowCount, 0)).toBe(MAX_VISIBLE_FLOORS);
  });

  it('drops a contributor with zero floors instead of rendering an empty band', () => {
    const { bands } = layoutLandmarkTower([
      { color: '#1', floors: 5 },
      { color: '#2', floors: 0 },
    ]);
    expect(bands).toHaveLength(1);
  });

  it('handles no contributors at all', () => {
    const { bands, totalRows, foldedFloors } = layoutLandmarkTower([]);
    expect(bands).toEqual([]);
    expect(totalRows).toBe(0);
    expect(foldedFloors).toBe(0);
  });

  it('caps the lit-top count at the visible total for a very short tower', () => {
    const { litTopCount } = layoutLandmarkTower([{ color: '#1', floors: 2 }]);
    expect(litTopCount).toBe(2);
  });
});
