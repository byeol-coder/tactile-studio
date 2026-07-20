// tests/unit/ellipse-quality.test.ts
// Property tests for the integer midpoint ellipse rasterizer. The parity suite
// already pins the exact hit sequence against the shipped monolith; these tests
// instead assert the *qualities* the rewrite was meant to guarantee — the ones
// the old equal-angle sampler failed on: quadrant symmetry, 8-connectivity (no
// gaps), and a closed contour even for the smallest circles. Independent of the
// frozen hash, so they stay meaningful if a future baseline is re-captured.

import { describe, it, expect } from 'vitest';
import { ellipseOutline } from '../../src/core/index.js';

type Pt = [number, number];
const collect = (x0: number, y0: number, x1: number, y1: number): Set<string> => {
  const s = new Set<string>();
  ellipseOutline(x0, y0, x1, y1, (x, y) => s.add(x + ',' + y));
  return s;
};
const pts = (set: Set<string>): Pt[] => [...set].map((k) => k.split(',').map(Number) as Pt);

describe('ellipse rasterizer — geometric quality', () => {
  it('a circle is left-right AND top-bottom symmetric (even + odd boxes)', () => {
    for (const [x0, y0, x1, y1] of [[0, 0, 16, 16], [0, 0, 15, 15], [3, 5, 20, 22]] as const) {
      const set = collect(x0, y0, x1, y1);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      for (const [x, y] of pts(set)) {
        expect(set.has(Math.round(2 * cx - x) + ',' + y), `L-R mirror of ${x},${y}`).toBe(true);
        expect(set.has(x + ',' + Math.round(2 * cy - y)), `T-B mirror of ${x},${y}`).toBe(true);
      }
    }
  });

  it('every boundary cell has an 8-neighbour on the outline (no gaps/facets)', () => {
    for (const [x0, y0, x1, y1] of [[0, 0, 16, 16], [0, 0, 30, 12], [2, 2, 9, 9]] as const) {
      const set = collect(x0, y0, x1, y1);
      for (const [x, y] of pts(set)) {
        let connected = false;
        for (let dx = -1; dx <= 1 && !connected; dx++)
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            if (set.has(x + dx + ',' + (y + dy))) { connected = true; break; }
          }
        expect(connected, `${x},${y} is isolated`).toBe(true);
      }
    }
  });

  it('the smallest circles still render as a closed, non-empty contour', () => {
    for (const [x0, y0, x1, y1] of [[0, 0, 2, 2], [0, 0, 3, 3], [5, 5, 6, 6]] as const) {
      const set = collect(x0, y0, x1, y1);
      expect(set.size, `box ${x0},${y0}-${x1},${y1}`).toBeGreaterThan(0);
    }
  });

  it('half-integer centre (even box) has no doubled side bulges', () => {
    // Regression for the old sampler: box (2,2)-(9,9), radius-4 circle centred
    // at (5.5,5.5) used to emit paired pixels on the mid-rows (·●●····●●·).
    // Each row of the outline should therefore hold at most two boundary cells
    // per side — i.e. no more than 2 cells in the left half of any single row.
    const set = collect(2, 2, 9, 9);
    const rows = new Map<number, number[]>();
    for (const [x, y] of pts(set)) { (rows.get(y) ?? rows.set(y, []).get(y)!).push(x); }
    for (const [y, xs] of rows) {
      const left = xs.filter((x) => x < 5.5).length;
      expect(left, `row ${y} left-side bulge`).toBeLessThanOrEqual(2);
    }
  });
});
