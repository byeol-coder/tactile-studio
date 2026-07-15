// src/codecs/dtms/dtms.ts
//
// DTMS (DotPad Tactile Model / graphic-layer HEX) codec.
//
// ENCODE is deliberately NOT reimplemented here. The shipped encoder lives in
// vendor/tw/pins.js (`TW.encodeBits`) and is treated as an external dependency
// per the migration principle "do not replace existing libraries with newly
// invented implementations." Callers inject it (see `TwEncodeBits`) so this
// module never forks the packing logic.
//
// DECODE is a verbatim port of the monolith's `corpusCellsFromHex` — the ONLY
// decode path ever shipped. It is deliberately hardcoded to 600 hex chars /
// 60×40 (dotpad320); a 96×64 (1536-char) string is NOT a valid input here,
// exactly like production. Do not generalize this without a reviewed,
// separately-tested change — it would be new behavior, not extraction.

import type { CellGrid } from '../../core/types.js';

export const DTMS_60X40_HEX_LENGTH = 600;
const COLS = 60, ROWS = 40, CELL_COLS = COLS / 2, CELL_ROWS = ROWS / 4;

/**
 * Decode a 600-char DTMS graphic-layer HEX into a 60×40 cell buffer.
 * Returns null for ANY invalid input (non-string, wrong length, non-hex) —
 * callers must fall back safely, never treat null as raw/passthrough data.
 */
export function decodeDtms60x40Hex(hex: unknown): CellGrid | null {
  const src = String(hex == null ? '' : hex).trim();
  if (!/^[0-9a-fA-F]{600}$/.test(src)) return null;
  const cells = new Uint8Array(COLS * ROWS);
  let idx = 0;
  for (let r = 0; r < CELL_ROWS; r++) {
    for (let c = 0; c < CELL_COLS; c++) {
      const b = parseInt(src.substr(idx * 2, 2), 16) || 0;
      idx++;
      for (let lx = 0; lx < 2; lx++) for (let ly = 0; ly < 4; ly++) {
        if ((b >> (lx * 4 + ly)) & 1) cells[(r * 4 + ly) * COLS + (c * 2 + lx)] = 1;
      }
    }
  }
  return cells;
}

/** Shape of the injected vendor encoder (vendor/tw/pins.js TW.encodeBits). */
export type TwEncodeBits = (bits: boolean[][], cols: number, rows: number) => string;

/** flat Uint8Array(w*h) → bits[row][col], the shape TW.encodeBits expects
 *  (verbatim port of the monolith's cellsToBits bridge). */
export function cellsToBits(cells: CellGrid, w: number, h: number): boolean[][] {
  const bits: boolean[][] = new Array(h);
  for (let y = 0; y < h; y++) {
    const row: boolean[] = new Array(w);
    for (let x = 0; x < w; x++) row[x] = !!cells[y * w + x];
    bits[y] = row;
  }
  return bits;
}

/** bits[row][col] → flat Uint8Array(w*h) (verbatim port of the monolith's
 *  bitsToCells bridge — the inverse of cellsToBits above). */
export function bitsToCells(bits: boolean[][], w: number, h: number): CellGrid {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bits[y] && bits[y][x]) out[y * w + x] = 1;
  return out;
}

/** Encode via the injected vendor encoder — thin orchestration only, no
 *  reimplementation of the packing algorithm. */
export function encodeDtmsHex(encodeBits: TwEncodeBits, cells: CellGrid, w: number, h: number): string {
  return encodeBits(cellsToBits(cells, w, h), w, h);
}

/**
 * Round-trip check for the 60×40 path: decode(encode(cells)) must be
 * value-for-value identical. Used by tests and available for callers that
 * want to validate before persisting.
 */
export function isDtms60x40RoundTripSafe(encodeBits: TwEncodeBits, cells: CellGrid): boolean {
  const hex = encodeDtmsHex(encodeBits, cells, 60, 40);
  const decoded = decodeDtms60x40Hex(hex);
  if (!decoded) return false;
  for (let i = 0; i < cells.length; i++) if (decoded[i] !== cells[i]) return false;
  return true;
}
