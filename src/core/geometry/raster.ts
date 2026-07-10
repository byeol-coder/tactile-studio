// src/core/geometry/raster.ts
// Verbatim ports of the monolith's shape rasterizers. These define what users
// draw AND what gets encoded to DTMS — visit order, rounding, the ellipse
// step count, and the flood-fill traversal order are all
// compatibility-sensitive. Parity tests compare ordered hit sequences against
// the shipped implementation; do not "optimize" the algorithms.

import type { CellGrid } from '../types.js';
import { cellIndex, inBounds } from '../grid/grid.js';

export type PlotFn = (x: number, y: number) => void;

/** Bresenham line — identical to the monolith's line(x0,y0,x1,y1,cb). */
export function line(x0: number, y0: number, x1: number, y1: number, cb: PlotFn): void {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    cb(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Rectangle outline — identical visit order (top+bottom rows, then sides). */
export function rectOutline(x0: number, y0: number, x1: number, y1: number, cb: PlotFn): void {
  const a = Math.min(x0, x1), b = Math.max(x0, x1);
  const c = Math.min(y0, y1), d = Math.max(y0, y1);
  for (let x = a; x <= b; x++) { cb(x, c); cb(x, d); }
  for (let y = c; y <= d; y++) { cb(a, y); cb(b, y); }
}

/** Ellipse outline — identical parametric sampling (steps = max(40, round((rx+ry)*6))). */
export function ellipseOutline(x0: number, y0: number, x1: number, y1: number, cb: PlotFn): void {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rx = Math.max(0.5, Math.abs(x1 - x0) / 2), ry = Math.max(0.5, Math.abs(y1 - y0) / 2);
  const steps = Math.max(40, Math.round((rx + ry) * 6));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    cb(Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a)));
  }
}

/**
 * Line-thickness brush — identical to the monolith's brushCb(baseCb, size):
 * size ≤1 → 1×1 (base as-is); size 2 → 2×2 (offsets [0,1]);
 * size ≥3 → 3×3 (offsets [-1,0,1]); oy outer, ox inner.
 */
export function makeBrush(baseCb: PlotFn, size: number): PlotFn {
  const n = size || 1;
  if (n <= 1) return baseCb;
  const offs = n === 2 ? [0, 1] : [-1, 0, 1];
  return (x, y) => { for (const oy of offs) for (const ox of offs) baseCb(x + ox, y + oy); };
}

/**
 * Flood fill — identical to the monolith's flood(x, y): fills the connected
 * region of the start cell's value to 1 (no-op when starting on a raised
 * pin), DFS stack with push order [x+1],[x-1],[y+1],[y-1], hard cap of
 * 30000 filled cells. Mutates `cells` in place, exactly like the original.
 */
export function floodFill(cells: CellGrid, w: number, h: number, x: number, y: number): void {
  const target = cells[cellIndex(w, x, y)];
  if (target === 1) return;
  const st: Array<[number, number]> = [[x, y]];
  let n = 0;
  while (st.length && n < 30000) {
    const [px, py] = st.pop() as [number, number];
    if (!inBounds(w, h, px, py)) continue;
    const i = cellIndex(w, px, py);
    if (cells[i] !== target) continue;
    cells[i] = 1; n++;
    st.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }
}
