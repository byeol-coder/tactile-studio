// src/codecs/svg/svg.ts
//
// Orchestration only — bitsToSVG itself lives in vendor/tw/pins.js and is
// injected, exactly like DTMS's encodeBits. This module just does the
// cellsToBits bridging so callers only need to supply the raw vendor
// function.

import type { CellGrid } from '../../core/types.js';
import { cellsToBits } from '../dtms/dtms.js';

export interface SvgOptions {
  cell?: number;
  dotR?: number;
  title?: string;
}

export type TwBitsToSvg = (bits: boolean[][], cols: number, rows: number, opts?: SvgOptions) => string;

/** monolith exportFormat('SVG'): bitsToSVG(bitsOf(cells), w, h, { title: name }) */
export function encodeSvg(bitsToSvg: TwBitsToSvg, cells: CellGrid, w: number, h: number, opts?: SvgOptions): string {
  return bitsToSvg(cellsToBits(cells, w, h), w, h, opts);
}
