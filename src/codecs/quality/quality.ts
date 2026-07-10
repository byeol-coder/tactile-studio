// src/codecs/quality/quality.ts
//
// Verbatim port of the monolith's convQuality and banaPrintCheck (the latter
// added in the `fix(studio): implement missing banaPrintCheck` commit).
// Pure, fully self-contained — no injected dependency needed, unlike the
// DTMS/vector/image codecs which wrap vendor libraries.

import type { CellGrid } from '../../core/types.js';

export type QualityKey = 'readable' | 'tooSparse' | 'tooDense' | 'manyIsolated';

export interface ConvQuality {
  dots: number;
  density: number;
  isolated: number;
  key: QualityKey;
}

/** monolith convQuality(cells, w, h) */
export function convQuality(cells: CellGrid, w: number, h: number): ConvQuality {
  let dots = 0;
  for (let i = 0; i < cells.length; i++) dots += cells[i];
  const density = dots / (w * h);
  let isolated = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!cells[y * w + x]) continue;
    let nb = 0;
    if (x > 0 && cells[y * w + x - 1]) nb++;
    if (x < w - 1 && cells[y * w + x + 1]) nb++;
    if (y > 0 && cells[(y - 1) * w + x]) nb++;
    if (y < h - 1 && cells[(y + 1) * w + x]) nb++;
    if (nb === 0) isolated++;
  }
  let key: QualityKey = 'readable';
  if (density < 0.03) key = 'tooSparse';
  else if (density > 0.40) key = 'tooDense';
  else if (dots > 0 && isolated / dots > 0.25) key = 'manyIsolated';
  return { dots, density, isolated, key };
}

export interface BanaCheckResult {
  pass: boolean;
  issues: string[];
  dots: number;
  density: number;
  isolated: number;
}

/** monolith banaPrintCheck(cells, w, h) (added in the banaPrintCheck fix commit) */
export function banaPrintCheck(cells: CellGrid, w: number, h: number): BanaCheckResult {
  const q = convQuality(cells, w, h);
  const issues: string[] = [];
  if (!q.dots) issues.push('empty');
  if (q.density > 0.40) issues.push('tooDense');
  if (q.dots > 0 && q.isolated / q.dots > 0.25) issues.push('manyIsolated');
  return { pass: issues.length === 0, issues, dots: q.dots, density: q.density, isolated: q.isolated };
}
