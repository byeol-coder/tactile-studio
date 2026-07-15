// src/ui/canvas/browser-glyph-rasterizer.ts
//
// Real browser-canvas glyph rasterization for the 'text' tool — the ONE
// piece of codecs/tactile-text/tactile-text.ts left as an injected
// GlyphRasterizer dependency (see that file's header comment). This IS the
// production implementation, verbatim-ported from the monolith's stampText
// renderGlyph closure: 3× supersampled rendering, coverage threshold 0.42,
// Pretendard Variable font family (never embedded — relies on the host page
// having loaded it, exactly like the monolith).
//
// NOT parity-tested pixel-for-pixel (documented, not silently skipped): font
// hinting/anti-aliasing are rendering-engine-specific, so there is no
// meaningful "shipped baseline" to compare against outside a real browser.
// Tests inject a synthetic GlyphRasterizer instead (see tests/parity).

import type { GlyphBitmap, GlyphRasterizer } from '../../codecs/tactile-text/tactile-text.js';

const SCALE = 3;
const COVER_T = 0.42;

export const browserGlyphRasterizer: GlyphRasterizer = (ch: string, rows: number, opts: { outline: boolean }): GlyphBitmap => {
  const cv = document.createElement('canvas');
  const probeCtx = cv.getContext('2d');
  const font = `700 ${rows * SCALE}px 'Pretendard Variable', Pretendard, sans-serif`;
  if (!probeCtx) return { data: new Uint8Array(0), w: 0, h: 0 };
  probeCtx.font = font;
  const m = probeCtx.measureText(ch);
  const w = Math.max(1, Math.ceil(m.width / SCALE) + 2);
  const h = rows + 3;
  cv.width = w * SCALE;
  cv.height = h * SCALE;
  const ctx = cv.getContext('2d');
  if (!ctx) return { data: new Uint8Array(w * h), w, h };
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = SCALE;
  if (opts.outline) ctx.strokeText(ch, SCALE, SCALE); else ctx.fillText(ch, SCALE, SCALE);
  const source = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const data = new Uint8Array(w * h);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    let ink = 0;
    for (let sy = 0; sy < SCALE; sy++) for (let sx = 0; sx < SCALE; sx++) {
      const srcX = px * SCALE + sx, srcY = py * SCALE + sy;
      ink += source[(srcY * cv.width + srcX) * 4 + 3] / 255;
    }
    data[py * w + px] = ink / (SCALE * SCALE) >= COVER_T ? 1 : 0;
  }
  return { data, w, h };
};
