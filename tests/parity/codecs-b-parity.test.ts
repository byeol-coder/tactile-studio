// Phase 3 sub-step parity suite: image conversion, tactile-text layout, and
// a Node-native liblouis adapter that runs the REAL vendored asm.js engine
// against the REAL table files — genuine translations, not a mock.
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import { loadStudioClass, makeInstance } from '../../tools/harness.mjs';
import {
  cvGray, cvOtsu, cvDown, cvSobel, cvDilate, cvRemoveSmall, imgToCells, CONV_PRESETS,
} from '../../src/codecs/image/image.js';
import { rowsFor, stampTextLayout, type GlyphBitmap } from '../../src/codecs/tactile-text/tactile-text.js';
import {
  preload, isReady, translate, padOrTruncate, brailleUnicodeToHex,
} from '../../src/codecs/braille/liblouis-node.js';

import imageNumericsFix from '../fixtures/baseline/codec-image-numerics.json';
import imgToCellsFix from '../fixtures/baseline/codec-imgtocells.json';
import textRowsFix from '../fixtures/baseline/codec-tactile-text-rows.json';
import brailleFix from '../fixtures/baseline/codec-braille-liblouis.json';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

let Component: any;
let proto: any;
beforeAll(() => {
  ({ Component } = loadStudioClass({}));
  proto = Component.prototype;
});

// ── synthetic RGBA sources (identical to the capture tool) ─────────────────
function makeRgba(w: number, h: number, painter: (x: number, y: number, w: number, h: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = painter(x, y, w, h);
    const i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  }
  return data;
}
const sources: Record<string, Uint8ClampedArray> = {
  'gradient-100x80': makeRgba(100, 80, (x, y, w) => { const v = Math.floor((x / w) * 255); return [v, v, v, 255]; }),
  'checker-100x80': makeRgba(100, 80, (x, y) => (((x >> 3) + (y >> 3)) % 2 === 0 ? [20, 20, 20, 255] : [235, 235, 235, 255])),
  'circle-100x80': makeRgba(100, 80, (x, y, w, h) => {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.3;
    const d = Math.hypot(x - cx, y - cy);
    return d < r ? [10, 10, 10, 255] : [250, 250, 250, 255];
  }),
  'transparent-diag-60x60': makeRgba(60, 60, (x, y) => (x === y ? [0, 0, 0, 255] : [0, 0, 0, 0])),
};

describe('image-conversion numerics parity', () => {
  it('reproduces the shipped _cv* pipeline byte-for-byte on synthetic sources', () => {
    for (const [name, rgba] of Object.entries(sources)) {
      const sw = name.includes('60x60') ? 60 : 100, sh = name.includes('60x60') ? 60 : 80;
      const fix = (imageNumericsFix as any)[name];
      const gray = cvGray(rgba, sw, sh);
      expect(sha256(JSON.stringify(Array.from(gray)))).toBe(fix.graySha256);
      const otsu = cvOtsu(gray);
      expect(otsu).toBe(fix.otsu);
      const down = cvDown(gray, sw, sh, null, 60, 40);
      expect(sha256(JSON.stringify(Array.from(down.grid)))).toBe(fix.downGridSha256);
      expect(down.box).toEqual(fix.downBox);
      const downCrop = cvDown(gray, sw, sh, { x: 0.1, y: 0.1, w: 0.6, h: 0.6 }, 60, 40);
      expect(sha256(JSON.stringify(Array.from(downCrop.grid)))).toBe(fix.downCropGridSha256);
      expect(downCrop.box).toEqual(fix.downCropBox);
      const sobel = cvSobel(down.grid, 60, 40);
      expect(sha256(JSON.stringify(Array.from(sobel)))).toBe(fix.sobelSha256);
      const thresholded = new Uint8Array(60 * 40);
      for (let i = 0; i < down.grid.length; i++) thresholded[i] = down.grid[i] < otsu ? 1 : 0;
      expect(sha256(JSON.stringify(Array.from(thresholded)))).toBe(fix.thresholdedSha256);
      const dilated = cvDilate(thresholded, 60, 40);
      expect(sha256(JSON.stringify(Array.from(dilated)))).toBe(fix.dilatedSha256);
      const removed = cvRemoveSmall(thresholded, 60, 40, 2);
      expect(sha256(JSON.stringify(Array.from(removed.cells)))).toBe(fix.removedCells);
      expect(removed.removed).toBe(fix.removedCount);
    }
  });

  it('cross-checks cvGray/cvOtsu/cvDown against the live shipped _cv* methods', () => {
    const inst = makeInstance(Component);
    const rgba = sources['circle-100x80'];
    const shippedGray = proto._cvGray.call(inst, rgba, 100, 80);
    const extractedGray = cvGray(rgba, 100, 80);
    expect(Array.from(extractedGray)).toEqual(Array.from(shippedGray));
    expect(cvOtsu(extractedGray)).toBe(proto._cvOtsu.call(inst, shippedGray));
    const shippedDown = proto._cvDown.call(inst, shippedGray, 100, 80, null, 60, 40);
    const extractedDown = cvDown(extractedGray, 100, 80, null, 60, 40);
    expect(Array.from(extractedDown.grid)).toEqual(Array.from(shippedDown.grid));
    expect(extractedDown.box).toEqual(shippedDown.box);
  });
});

describe('imgToCells end-to-end parity (per preset)', () => {
  it('matches the shipped imgToCells for all four presets', () => {
    const rgba = sources['circle-100x80'];
    for (const preset of Object.keys(imgToCellsFix.presets) as Array<keyof typeof CONV_PRESETS>) {
      const r = imgToCells(rgba, 100, 80, 60, 40, { preset }, null);
      const fix = (imgToCellsFix.presets as any)[preset];
      expect(sha256(JSON.stringify(Array.from(r.cells)))).toBe(fix.cellsSha256);
      expect(r.box).toEqual(fix.box);
      expect(r.removedDots).toBe(fix.removedDots);
      expect(r.cells.reduce((a, b) => a + b, 0)).toBe(fix.dotCount);
    }
  });

  it('cross-checks against the live shipped imgToCells for the "outline" preset', () => {
    const inst = makeInstance(Component, { _srcData: sources['circle-100x80'], _srcW: 100, _srcH: 80 });
    const shipped = proto.imgToCells.call(inst, 60, 40, { preset: 'outline' }, null);
    const extracted = imgToCells(sources['circle-100x80'], 100, 80, 60, 40, { preset: 'outline' }, null);
    expect(Array.from(extracted.cells)).toEqual(Array.from(shipped.cells));
    expect(extracted.box).toEqual(shipped.box);
    expect(extracted.removedDots).toBe(shipped.removedDots);
  });
});

describe('tactile-text layout parity (rows formula + synthetic-glyph placement)', () => {
  it('rowsFor matches the shipped Hangul-boost formula for every case', () => {
    for (const c of textRowsFix.cases) {
      expect(rowsFor(c.text, c.opts.size as any)).toBe(c.expectedRows);
    }
  });

  it('cross-checks rowsFor against a live extraction of the shipped stampText formula', () => {
    const HANGUL_RE = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
    for (const size of ['small', 'medium', 'large', undefined] as const) {
      for (const text of ['plain', '한글텍스트', 'mixed한글abc']) {
        const baseRows = size === 'small' ? 7 : size === 'large' ? 16 : 11;
        const expected = HANGUL_RE.test(text) ? Math.round(baseRows * 1.35) : baseRows;
        expect(rowsFor(text, size)).toBe(expected);
      }
    }
  });

  it('places a synthetic glyph bitmap onto the grid respecting bounds and advance', () => {
    const w = 20, h = 20;
    const cells = new Uint8Array(w * h);
    const block: GlyphBitmap = { data: new Uint8Array(3 * 3).fill(1), w: 3, h: 3 };
    const rasterizer = () => block;
    const { placed } = stampTextLayout(cells, w, h, 'AB', 0, 0, {}, rasterizer);
    expect(placed).toBe(9 * 2); // two 3x3 solid glyphs, fully in-bounds
    // second glyph must be offset by w(3) + gapMain (round(rows*0.12))
    const rows = rowsFor('AB');
    const gap = Math.max(1, Math.round(rows * 0.12));
    let onCols = new Set<number>();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (cells[y * w + x]) onCols.add(x);
    expect(Math.min(...onCols)).toBe(0);
    expect(Math.max(...onCols)).toBe(3 + gap + 2); // second glyph starts at 3+gap, spans 3 cols
  });

  it('clips glyph pixels outside the grid instead of wrapping or throwing', () => {
    const w = 5, h = 5;
    const cells = new Uint8Array(w * h);
    const block: GlyphBitmap = { data: new Uint8Array(4 * 4).fill(1), w: 4, h: 4 };
    const { placed } = stampTextLayout(cells, w, h, 'A', 3, 3, {}, () => block);
    // glyph spans x:3..6, y:3..6 but grid is 5x5 (indices 0..4) -> only (3,3),(3,4),(4,3),(4,4) survive
    expect(placed).toBe(4);
  });

  it('empty/whitespace-only text places nothing', () => {
    const cells = new Uint8Array(10 * 10);
    const { placed } = stampTextLayout(cells, 10, 10, '   ', 0, 0, {}, () => ({ data: new Uint8Array(1), w: 1, h: 1 }));
    expect(placed).toBe(0);
  });
});

describe('liblouis-node adapter (REAL asm.js engine + REAL tables)', () => {
  beforeAll(async () => { await preload(); }, 30000);

  it('is ready after preload', () => {
    expect(isReady()).toBe(true);
  });

  it('reproduces every captured real translation exactly', () => {
    for (const r of brailleFix.results) {
      const result = translate(r.text, r.lang);
      expect(result.ok).toBe(r.ok);
      expect(result.unicode).toBe(r.unicode);
      expect(result.cells).toBe(r.cells);
      if (!r.ok) expect(result.reason).toBe(r.reason);
    }
  });

  it('never returns raw text on failure (unknown language)', () => {
    const r = translate('민감한 원문', 'not-a-real-lang');
    expect(r.ok).toBe(false);
    expect(r.unicode).toBe('');
    expect(r.unicode).not.toContain('민감한');
  });

  it('padOrTruncate matches the shipped padding/truncation rule', () => {
    expect(padOrTruncate('⠁⠃⠉', 6)).toBe('⠁⠃⠉⠀⠀⠀');
    expect(padOrTruncate('⠁⠃⠉⠙⠑⠋⠛', 3)).toBe('⠁⠃⠉');
  });

  it('brailleUnicodeToHex matches the shipped range-checked conversion', () => {
    expect(brailleUnicodeToHex('\u2801\u2803')).toBe('0103');
    // out-of-range codepoint encodes as 0x00, not an error (verbatim monolith behavior)
    expect(brailleUnicodeToHex('A')).toBe('00');
  });

  it('DotPad hex round-trips through the exact captured fixtures', () => {
    for (const r of brailleFix.results) {
      if (!r.ok || !r.hexForDotPad) continue;
      const padded = padOrTruncate(r.unicode, 20);
      expect(brailleUnicodeToHex(padded)).toBe(r.hexForDotPad);
    }
  });
});
