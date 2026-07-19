// src/codecs/quality/quality.ts
//
// Verbatim port of the monolith's convQuality and banaPrintCheck. The latter
// was independently (re-)implemented twice: once by this migration branch
// itself (Phase 1, before the fork) and once by vanilla `main` afterwards
// (`addd43a`, 2026-07-13) with a different shape. This module now matches
// the real shipped `main` implementation — see the doc comment on
// banaPrintCheck below and docs/known-issues.md #1.
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
  key: QualityKey;
  density: number;
  isolated: number;
  dots: number;
}

export type QualityIssue = { key: string; level: 'info' | 'warn'; message: string };
export interface TactileQualityReport extends ConvQuality {
  pass: boolean;
  thin: number;
  thinRatio: number;
  tightGaps: number;
  components: number;
  issues: QualityIssue[];
}

/** Extended, presentation-ready tactile checks. convQuality remains unchanged
 * for codec compatibility; this adds only advisory warnings for the editor. */
export function analyzeTactileQuality(cells: CellGrid, w: number, h: number): TactileQualityReport {
  const base = convQuality(cells, w, h);
  let thin = 0;
  const labels = new Int32Array(w * h);
  let components = 0;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !!cells[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y)) continue;
    const horizontal = !on(x - 1, y) && !on(x + 1, y);
    const vertical = !on(x, y - 1) && !on(x, y + 1);
    if (horizontal || vertical) thin++;
    const start = y * w + x;
    if (labels[start]) continue;
    labels[start] = ++components;
    const stack = [start];
    while (stack.length) {
      const i = stack.pop()!, px = i % w, py = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy, ni = ny * w + nx;
        if ((dx || dy) && on(nx, ny) && !labels[ni]) { labels[ni] = components; stack.push(ni); }
      }
    }
  }
  let tightGaps = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!on(x, y)) {
    const seen = new Set<number>();
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && labels[ny * w + nx]) seen.add(labels[ny * w + nx]);
    }
    if (seen.size > 1) tightGaps++;
  }
  const thinRatio = base.dots ? thin / base.dots : 0;
  const issues: QualityIssue[] = [];
  if (!base.dots) issues.push({ key: 'empty', level: 'info', message: 'No raised pins yet.' });
  else {
    if (base.key === 'tooDense') issues.push({ key: 'tooDense', level: 'warn', message: `Pins are dense (${Math.round(base.density * 100)}%).` });
    if (base.key === 'tooSparse') issues.push({ key: 'tooSparse', level: 'info', message: `Few pins are raised (${Math.round(base.density * 100)}%).` });
    if (base.isolated / base.dots > .25) issues.push({ key: 'manyIsolated', level: 'warn', message: `${base.isolated} isolated pins detected.` });
    if (thinRatio > .5) issues.push({ key: 'thin', level: 'warn', message: `Thin strokes (${Math.round(thinRatio * 100)}%).` });
    if (tightGaps) issues.push({ key: 'tightGap', level: 'warn', message: `${tightGaps} tight gaps between elements.` });
  }
  return { ...base, pass: !issues.some((i) => i.level === 'warn'), thin, thinRatio, tightGaps, components, issues };
}

/** monolith banaPrintCheck(cells, w, h).
 *
 * NOTE ON SHAPE: the migration branch's own earlier `fix(studio): implement
 * missing banaPrintCheck` (Phase 1, before this branch forked from main)
 * invented an `{ pass, issues: string[] }` shape. Vanilla `main` was fixed
 * completely independently afterwards, on 2026-07-13, in `addd43a` — with
 * NO awareness of the migration branch's fix — landing on a DIFFERENT shape:
 * `{ pass, key, density, isolated, dots }` (reusing convQuality's `key`
 * rather than a multi-issue array). This function now matches the real
 * shipped shape, superseding this codec's own earlier guess. Every actual
 * consumer in this repo only reads `.pass` (see
 * codecs/library-asset-v1/library-asset-v1.ts's `BanaCheckFn` type, which
 * only requires `{ pass: boolean }`), so this was a safe, non-breaking
 * change here — but the raw shape has changed and is documented in
 * docs/known-issues.md #1. */
export function banaPrintCheck(cells: CellGrid, w: number, h: number): BanaCheckResult {
  const q = convQuality(cells, w, h);
  return { pass: q.key === 'readable', key: q.key, density: q.density, isolated: q.isolated, dots: q.dots };
}
