// src/core/grid/grid.ts
// Verbatim ports of the monolith's grid primitives. Loop order, rounding
// (Math.floor nearest-neighbor), and index math must stay byte-identical —
// parity tests compare against the shipped implementation.

import type { CellGrid } from '../types.js';

/** row-major flat index (monolith: idx(x, y) = y * gridW + x) */
export function cellIndex(w: number, x: number, y: number): number {
  return y * w + x;
}

/** bounds check (monolith: inb) */
export function inBounds(w: number, h: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

export function createGrid(w: number, h: number): CellGrid {
  return new Uint8Array(w * h);
}

export function cloneGrid(cells: CellGrid): CellGrid {
  return cells.slice();
}

/**
 * Nearest-neighbor resample used when the output grid changes
 * (monolith setGrid): nw[y*w+x] = old[floor(y*oh/h)*ow + floor(x*ow/w)].
 */
export function resampleGrid(old: CellGrid, ow: number, oh: number, w: number, h: number): CellGrid {
  const nw = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    nw[y * w + x] = old[Math.floor((y * oh) / h) * ow + Math.floor((x * ow) / w)];
  }
  return nw;
}

/** monolith flipHoriz core loop (pure: returns a new buffer) */
export function flipHoriz(cells: CellGrid, w: number, h: number): CellGrid {
  const n = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n[y * w + x] = cells[y * w + (w - 1 - x)];
  return n;
}

/** monolith flipVert core loop (pure: returns a new buffer) */
export function flipVert(cells: CellGrid, w: number, h: number): CellGrid {
  const n = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n[y * w + x] = cells[(h - 1 - y) * w + x];
  return n;
}

/** monolith invertAll core loop (pure) */
export function invertAll(cells: CellGrid): CellGrid {
  const n = cells.slice();
  for (let i = 0; i < n.length; i++) n[i] ^= 1;
  return n;
}

/** monolith clearAll core (pure) */
export function clearAll(cells: CellGrid): CellGrid {
  const n = cells.slice();
  n.fill(0);
  return n;
}
