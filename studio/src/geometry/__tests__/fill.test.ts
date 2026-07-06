import { describe, expect, it } from 'vitest';
import { floodFill, polygonFillCells } from '../fill';
import type { Dims } from '../../a11y/cursor';

const G: Dims = { width: 10, height: 10 };
const keySet = (pts: { x: number; y: number }[]) => new Set(pts.map((p) => `${p.x},${p.y}`));

describe('floodFill', () => {
  it('fills the whole grid when everything shares the seed state', () => {
    const region = floodFill({ x: 0, y: 0 }, G, () => false);
    expect(region).toHaveLength(100);
  });

  it('stops at a differing-state boundary', () => {
    // A vertical wall of "true" at x=5 splits the grid; seed on the left.
    const get = (x: number) => x === 5;
    const region = floodFill({ x: 0, y: 0 }, G, get);
    const keys = keySet(region);
    expect(region).toHaveLength(50); // columns 0..4 × 10 rows
    expect(keys.has('4,3')).toBe(true);
    expect(keys.has('5,3')).toBe(false); // the wall
    expect(keys.has('6,3')).toBe(false); // the far side
  });

  it('is 4-connected (does not leak diagonally)', () => {
    // "true" everywhere except a diagonal gap; seed inside a pocket.
    const wall = new Set(['1,0', '0,1']); // corner pocket at (0,0)
    const get = (x: number, y: number) => wall.has(`${x},${y}`);
    const region = floodFill({ x: 0, y: 0 }, G, get);
    // (0,0) is false; neighbors (1,0) and (0,1) are true → only (0,0) fills.
    expect(region).toEqual([{ x: 0, y: 0 }]);
  });

  it('returns empty for an out-of-bounds seed', () => {
    expect(floodFill({ x: -1, y: 0 }, G, () => false)).toEqual([]);
  });
});

describe('polygonFillCells', () => {
  it('fills a solid square interior + border', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const cells = polygonFillCells(square);
    const keys = keySet(cells);
    // 5x5 solid
    for (let y = 0; y <= 4; y++) for (let x = 0; x <= 4; x++) expect(keys.has(`${x},${y}`)).toBe(true);
    expect(cells).toHaveLength(25);
  });

  it('fills a triangle interior', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 4 },
    ];
    const keys = keySet(polygonFillCells(tri));
    expect(keys.has('1,1')).toBe(true); // interior
    expect(keys.has('0,0')).toBe(true); // vertex
    expect(keys.has('4,4')).toBe(false); // outside the hypotenuse
  });

  it('falls back to a closed outline for < 3 points', () => {
    const cells = polygonFillCells([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
    expect(keySet(cells).has('1,0')).toBe(true);
  });
});
