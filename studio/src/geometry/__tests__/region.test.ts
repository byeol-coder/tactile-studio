import { describe, expect, it } from 'vitest';
import { clampOffset, fitToGridChanges, normRect, regionMoveCells, rectContains } from '../region';
import type { Dims } from '../../a11y/cursor';

const G: Dims = { width: 10, height: 10 };
const valueAt = (cells: { x: number; y: number; value: boolean }[], x: number, y: number) =>
  cells.find((c) => c.x === x && c.y === y)?.value;

describe('normRect', () => {
  it('normalizes any two corners', () => {
    expect(normRect({ x: 4, y: 3 }, { x: 1, y: 5 })).toEqual({ x0: 1, y0: 3, x1: 4, y1: 5 });
  });
});

describe('rectContains', () => {
  it('tests inclusion', () => {
    const r = { x0: 1, y0: 1, x1: 3, y1: 3 };
    expect(rectContains(r, 2, 2)).toBe(true);
    expect(rectContains(r, 3, 3)).toBe(true);
    expect(rectContains(r, 4, 2)).toBe(false);
  });
});

describe('clampOffset', () => {
  it('keeps the rect inside the grid', () => {
    const r = { x0: 0, y0: 0, x1: 2, y1: 2 };
    expect(clampOffset(r, { dx: -5, dy: 0 }, G)).toEqual({ dx: 0, dy: 0 }); // can't go past left
    expect(clampOffset(r, { dx: 99, dy: 0 }, G)).toEqual({ dx: 7, dy: 0 }); // x1=2 → max +7 (→9)
    expect(clampOffset(r, { dx: 3, dy: 4 }, G)).toEqual({ dx: 3, dy: 4 }); // within bounds
  });
});

describe('regionMoveCells — move', () => {
  // source region (0,0)-(1,0): [raised, lowered]
  const get = (x: number, y: number) => x === 0 && y === 0; // only (0,0) raised
  const source = normRect({ x: 0, y: 0 }, { x: 1, y: 0 });

  it('clears source and stamps the pattern at the destination', () => {
    const cells = regionMoveCells(source, { dx: 0, dy: 5 }, get, G, 'move');
    // source cleared
    expect(valueAt(cells, 0, 0)).toBe(false);
    expect(valueAt(cells, 1, 0)).toBe(false);
    // destination stamped: (0,5) raised (from (0,0)), (1,5) lowered (from (1,0))
    expect(valueAt(cells, 0, 5)).toBe(true);
    expect(valueAt(cells, 1, 5)).toBe(false);
  });

  it('overlap: the stamped destination wins over the source-clear', () => {
    // move right by 1 → (1,0) is both a source cell (cleared) and a dest cell (stamped)
    const cells = regionMoveCells(source, { dx: 1, dy: 0 }, get, G, 'move');
    expect(valueAt(cells, 0, 0)).toBe(false); // source-only → cleared
    expect(valueAt(cells, 1, 0)).toBe(true); // dest of (0,0)=raised → wins over clear
    expect(valueAt(cells, 2, 0)).toBe(false); // dest of (1,0)=lowered
  });

  it('clips destination cells that fall off-grid', () => {
    const cells = regionMoveCells(source, { dx: 0, dy: 100 }, get, G, 'move');
    // all destinations off-grid → only the source-clears remain
    expect(cells.every((c) => c.value === false)).toBe(true);
    expect(cells).toHaveLength(2);
  });
});

describe('regionMoveCells — copy', () => {
  const get = (x: number, y: number) => x === 0 && y === 0;
  const source = normRect({ x: 0, y: 0 }, { x: 1, y: 0 });

  it('leaves the source untouched and stamps the destination', () => {
    const cells = regionMoveCells(source, { dx: 0, dy: 3 }, get, G, 'copy');
    // no source-clear entries
    expect(valueAt(cells, 0, 0)).toBeUndefined();
    expect(valueAt(cells, 0, 3)).toBe(true);
    expect(valueAt(cells, 1, 3)).toBe(false);
  });

  it('zero offset copy is a full no-op set (source == dest)', () => {
    const cells = regionMoveCells(source, { dx: 0, dy: 0 }, get, G, 'copy');
    expect(valueAt(cells, 0, 0)).toBe(true);
    expect(valueAt(cells, 1, 0)).toBe(false);
  });
});

describe('fitToGridChanges', () => {
  it('empty content → no changes', () => {
    expect(fitToGridChanges([], G)).toEqual([]);
  });

  it('centers a single corner dot', () => {
    const changes = fitToGridChanges([{ x: 0, y: 0 }], G); // 10×10 grid
    expect(valueAt(changes, 0, 0)).toBe(false); // source cleared
    expect(valueAt(changes, 4, 4)).toBe(true); // centered: floor((10-1)/2)=4
  });

  it('already-centered content → no changes', () => {
    // A 2×2 block centered in a 10×10 grid sits at x,y ∈ {4,5}.
    const block = [
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(fitToGridChanges(block, G)).toEqual([]);
  });
});
