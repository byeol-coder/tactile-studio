// src/codecs/grid-fx/grid-fx.ts
//
// Orchestration only — thickenBits/denoiseBits themselves live in
// vendor/tw/pins.js and are injected, exactly like DTMS's encodeBits. This
// mirrors the monolith's applyGridFx/thickenFx/denoiseFx: convert to the
// bits[row][col] bridge shape, call the injected vendor function, convert
// back, done.

import type { CellGrid } from '../../core/types.js';
import { cellsToBits, bitsToCells } from '../dtms/dtms.js';

export type TwThickenBits = (bits: boolean[][], w: number, h: number, level: number) => boolean[][];
export type TwDenoiseBits = (bits: boolean[][], w: number, h: number) => boolean[][];

/** monolith thickenFx(level): level<0 thinner (erode), 0 unchanged, >0 thicker (dilate ×level). */
export function thickenGrid(thickenBits: TwThickenBits, cells: CellGrid, w: number, h: number, level: number): CellGrid {
  return bitsToCells(thickenBits(cellsToBits(cells, w, h), w, h, level), w, h);
}

/** monolith denoiseFx(): removes small noise clusters. */
export function denoiseGrid(denoiseBits: TwDenoiseBits, cells: CellGrid, w: number, h: number): CellGrid {
  return bitsToCells(denoiseBits(cellsToBits(cells, w, h), w, h), w, h);
}
