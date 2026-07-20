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

/**
 * Ellipse outline — integer midpoint ellipse inscribed in the bounding box
 * (Bresenham/Zingl "plotEllipseRect"). Kept byte-for-byte in step with the
 * monolith's ellipseOutline(). Replaces the earlier equal-angle parametric
 * sampler, whose Math.round() step produced doubled "bulge" pixels on the sides
 * (faceting / uneven curvature) and could gap on the smallest circles. This
 * integer form is quadrant-symmetric and 8-connected by construction.
 */
export function ellipseOutline(x0: number, y0: number, x1: number, y1: number, cb: PlotFn): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  let a = Math.abs(x1 - x0), b = Math.abs(y1 - y0); let b1 = b & 1; // pixel diameters
  if (a === 0 && b === 0) { cb(x0, y0); return; }
  if (a === 0) { const lo = Math.min(y0, y1), hi = Math.max(y0, y1); for (let y = lo; y <= hi; y++) cb(x0, y); return; }
  if (b === 0) { const lo = Math.min(x0, x1), hi = Math.max(x0, x1); for (let x = lo; x <= hi; x++) cb(x, y0); return; }
  let dx = 4 * (1 - a) * b * b, dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a, e2;
  if (x0 > x1) { x0 = x1; x1 += a; }
  if (y0 > y1) { y0 = y1; }
  y0 += ((b + 1) / 2) | 0; y1 = y0 - b1;
  a = 8 * a * a; b1 = 8 * b * b;
  do {
    cb(x1, y0); cb(x0, y0); cb(x0, y1); cb(x1, y1);
    e2 = 2 * err;
    if (e2 <= dy) { y0++; y1--; err += dy += a; }
    if (e2 >= dx || 2 * err > dy) { x0++; x1--; err += dx += b1; }
  } while (x0 <= x1);
  while (y0 - y1 <= b) {
    cb(x0 - 1, y0); cb(x1 + 1, y0++);
    cb(x0 - 1, y1); cb(x1 + 1, y1--);
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
