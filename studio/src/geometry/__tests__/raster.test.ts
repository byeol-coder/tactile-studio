import { describe, expect, it } from 'vitest';
import { bresenhamLine, ellipseCells, polylineCells, rectCells } from '../raster';

const keys = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`);
const has = (pts: { x: number; y: number }[], x: number, y: number) =>
  pts.some((p) => p.x === x && p.y === y);

describe('bresenhamLine', () => {
  it('single point when start === end', () => {
    expect(bresenhamLine(3, 3, 3, 3)).toEqual([{ x: 3, y: 3 }]);
  });

  it('horizontal line', () => {
    expect(keys(bresenhamLine(0, 2, 3, 2))).toEqual(['0,2', '1,2', '2,2', '3,2']);
  });

  it('vertical line', () => {
    expect(keys(bresenhamLine(5, 0, 5, 3))).toEqual(['5,0', '5,1', '5,2', '5,3']);
  });

  it('perfect diagonal', () => {
    expect(keys(bresenhamLine(0, 0, 3, 3))).toEqual(['0,0', '1,1', '2,2', '3,3']);
  });

  it('includes both endpoints and is contiguous (steep line)', () => {
    const pts = bresenhamLine(0, 0, 2, 5);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 2, y: 5 });
    // every step moves by at most 1 in each axis (contiguous)
    for (let i = 1; i < pts.length; i++) {
      expect(Math.abs(pts[i].x - pts[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(pts[i].y - pts[i - 1].y)).toBeLessThanOrEqual(1);
    }
  });

  it('reversed direction yields the same cells (order reversed)', () => {
    const fwd = keys(bresenhamLine(1, 1, 6, 3)).sort();
    const rev = keys(bresenhamLine(6, 3, 1, 1)).sort();
    expect(fwd).toEqual(rev);
  });
});

describe('rectCells', () => {
  it('outline is the border only (corners included, interior empty)', () => {
    const cells = rectCells({ x: 0, y: 0 }, { x: 3, y: 2 }, false);
    // 3x4 border = perimeter 2*(4+3) - 4 = 10 cells
    expect(cells).toHaveLength(10);
    expect(has(cells, 0, 0)).toBe(true);
    expect(has(cells, 3, 2)).toBe(true);
    expect(has(cells, 1, 1)).toBe(false); // interior not drawn
  });

  it('fill covers every cell in the box', () => {
    const cells = rectCells({ x: 0, y: 0 }, { x: 3, y: 2 }, true);
    expect(cells).toHaveLength(4 * 3);
    expect(has(cells, 1, 1)).toBe(true);
  });

  it('normalizes reversed corners', () => {
    const a = keys(rectCells({ x: 3, y: 2 }, { x: 0, y: 0 }, true)).sort();
    const b = keys(rectCells({ x: 0, y: 0 }, { x: 3, y: 2 }, true)).sort();
    expect(a).toEqual(b);
  });
});

describe('ellipseCells', () => {
  it('fill is a superset of the outline and includes the center', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 8, y: 6 };
    const fill = ellipseCells(from, to, true);
    const outline = ellipseCells(from, to, false);
    const fillKeys = new Set(keys(fill));
    expect(outline.every((c) => fillKeys.has(`${c.x},${c.y}`))).toBe(true);
    expect(outline.length).toBeLessThan(fill.length);
    expect(has(fill, 4, 3)).toBe(true); // center filled
    expect(has(outline, 4, 3)).toBe(false); // center not on the outline
  });

  it('single-cell box yields one cell', () => {
    expect(ellipseCells({ x: 5, y: 5 }, { x: 5, y: 5 }, false)).toEqual([{ x: 5, y: 5 }]);
  });
});

describe('polylineCells', () => {
  it('open polyline connects consecutive points only', () => {
    const cells = polylineCells([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }], false);
    expect(has(cells, 0, 0)).toBe(true);
    expect(has(cells, 2, 2)).toBe(true);
    expect(has(cells, 0, 1)).toBe(false); // no closing edge back to start
  });

  it('closed polygon adds the last→first edge', () => {
    const open = polylineCells([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }], false);
    const closed = polylineCells([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }], true);
    expect(closed.length).toBeGreaterThan(open.length);
    expect(has(closed, 1, 1)).toBe(true); // diagonal closing edge (2,2)->(0,0)
  });

  it('de-duplicates shared vertices', () => {
    const cells = polylineCells([{ x: 0, y: 0 }, { x: 3, y: 0 }], false);
    expect(keys(cells)).toEqual(['0,0', '1,0', '2,0', '3,0']);
  });
});
