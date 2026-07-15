// src/codecs/tactile-text/tactile-text.ts
//
// Partial extraction of the monolith's stampText (묵자 print-text-to-tactile).
// The GLYPH RASTERIZATION step (rendering a character to a bitmap via
// `document.createElement('canvas')` + `ctx.font = "...Pretendard..."` +
// `getImageData`) is NOT ported: font hinting/anti-aliasing is rendering-
// engine-specific (Skia in Chrome vs. any Node-side rasterizer), so claiming
// byte-parity there would be exactly the "fake compatibility" the migration
// principles warn against. That step is left as an injected
// `GlyphRasterizer` dependency — the browser implementation (canvas-based)
// stays in index.html unchanged.
//
// Everything else — Hangul detection, row-height scaling (1.35× boost),
// vertical/horizontal advance, inter-glyph gap, space width, and placing a
// glyph's coverage bitmap onto the grid — IS pure, IS extracted, and IS
// parity-tested here using synthetic bitmaps (see tests/parity).

import type { CellGrid } from '../../core/types.js';

const HANGUL_RE = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;

export interface StampTextOptions {
  size?: 'small' | 'medium' | 'large';
  orient?: 'horizontal' | 'vertical';
  style?: 'fill' | 'outline';
}

export interface GlyphBitmap {
  data: Uint8Array; // coverage mask, 1 = ink, row-major w×h
  w: number;
  h: number;
}

/** Injected per-character rasterizer — the ONLY browser-canvas-dependent
 *  seam. `rows` is the already-Hangul-boosted glyph height in cells. */
export type GlyphRasterizer = (ch: string, rows: number, opts: { outline: boolean }) => GlyphBitmap;

/** monolith stampText's row-height rule: base rows by size, ×1.35 if the
 *  text contains any Hangul syllable/jamo. */
export function rowsFor(text: string, size?: StampTextOptions['size']): number {
  const baseRows = size === 'small' ? 7 : size === 'large' ? 16 : 11;
  return HANGUL_RE.test(text) ? Math.round(baseRows * 1.35) : baseRows;
}

export interface PlacementResult {
  /** cells mutated in place, matching the monolith's direct `this.cells[...] = 1` writes */
  placed: number;
}

/**
 * monolith stampText, minus canvas rasterization and snapshot()/bump()
 * orchestration (those are editor-integration concerns, not codec logic).
 * Mutates `cells` in place exactly like production; returns the placed-dot
 * count so callers can replicate the `placed > 0` success check.
 */
export function stampTextLayout(
  cells: CellGrid, gridW: number, gridH: number,
  rawText: string, gx: number, gy: number,
  opts: StampTextOptions, rasterizeGlyph: GlyphRasterizer,
): PlacementResult {
  const text = String(rawText || '').slice(0, 32);
  if (!text.trim()) return { placed: 0 };
  const rows = rowsFor(text, opts.size);
  const vertical = opts.orient === 'vertical';
  const outline = opts.style === 'outline';
  const chars = Array.from(text);
  const gapMain = Math.max(1, Math.round(rows * 0.12));
  const spaceAdv = Math.round(rows * 0.5);

  let penX = gx, penY = gy, placed = 0;
  for (const ch of chars) {
    if (ch === ' ' || ch === '\n') {
      if (vertical) penY += spaceAdv; else penX += spaceAdv;
      continue;
    }
    const g = rasterizeGlyph(ch, rows, { outline });
    for (let py = 0; py < g.h; py++) for (let px = 0; px < g.w; px++) {
      if (g.data[py * g.w + px]) {
        const tx = penX + px, ty = penY + py;
        if (tx >= 0 && ty >= 0 && tx < gridW && ty < gridH) {
          cells[ty * gridW + tx] = 1;
          placed++;
        }
      }
    }
    if (vertical) penY += g.h + gapMain; else penX += g.w + gapMain;
  }
  return { placed };
}
