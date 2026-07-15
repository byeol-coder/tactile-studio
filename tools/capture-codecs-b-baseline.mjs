// tools/capture-codecs-b-baseline.mjs
// Phase 3 sub-step: record the SHIPPED implementation's image-conversion and
// tactile-text-layout outputs, plus REAL liblouis translations (same asm.js
// engine + tables the browser uses), as frozen fixtures.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStudioClass, makeInstance, mulberry32 } from './harness.mjs';
import { preload, translate, padOrTruncate, brailleUnicodeToHex } from '../src/codecs/braille/liblouis-node.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'fixtures', 'baseline');
mkdirSync(OUT, { recursive: true });
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const write = (name, data) => {
  writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + '\n');
  console.log('wrote', name);
};

const { Component } = loadStudioClass({});
const proto = Component.prototype;

// ── synthetic RGBA source images (deterministic, no real image decode) ──────
function makeRgba(w, h, painter) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = painter(x, y, w, h);
    const i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  }
  return data;
}

const sources = {
  'gradient-100x80': makeRgba(100, 80, (x, y, w) => { const v = Math.floor((x / w) * 255); return [v, v, v, 255]; }),
  'checker-100x80': makeRgba(100, 80, (x, y) => (((x >> 3) + (y >> 3)) % 2 === 0 ? [20, 20, 20, 255] : [235, 235, 235, 255])),
  'circle-100x80': makeRgba(100, 80, (x, y, w, h) => {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.3;
    const d = Math.hypot(x - cx, y - cy);
    return d < r ? [10, 10, 10, 255] : [250, 250, 250, 255];
  }),
  'transparent-diag-60x60': makeRgba(60, 60, (x, y) => (x === y ? [0, 0, 0, 255] : [0, 0, 0, 0])),
};

// ── image-conversion pure numerics ───────────────────────────────────────────
{
  const inst = makeInstance(Component);
  const out = {};
  for (const [name, rgba] of Object.entries(sources)) {
    const sw = name.includes('60x60') ? 60 : 100, sh = name.includes('60x60') ? 60 : 80;
    const gray = proto._cvGray.call(inst, rgba, sw, sh);
    const grayArr = Array.from(gray);
    const otsu = proto._cvOtsu.call(inst, gray);
    const down = proto._cvDown.call(inst, gray, sw, sh, null, 60, 40);
    const downCrop = proto._cvDown.call(inst, gray, sw, sh, { x: 0.1, y: 0.1, w: 0.6, h: 0.6 }, 60, 40);
    const sobel = proto._cvSobel.call(inst, down.grid, 60, 40);
    const thresholded = new Uint8Array(60 * 40);
    for (let i = 0; i < down.grid.length; i++) thresholded[i] = down.grid[i] < otsu ? 1 : 0;
    const dilated = proto._cvDilate.call(inst, thresholded, 60, 40);
    const removed = proto._cvRemoveSmall.call(inst, thresholded, 60, 40, 2);
    out[name] = {
      graySha256: sha256(JSON.stringify(grayArr)),
      grayLength: grayArr.length,
      otsu,
      downGridSha256: sha256(JSON.stringify(Array.from(down.grid))),
      downBox: down.box,
      downCropGridSha256: sha256(JSON.stringify(Array.from(downCrop.grid))),
      downCropBox: downCrop.box,
      sobelSha256: sha256(JSON.stringify(Array.from(sobel))),
      thresholdedSha256: sha256(JSON.stringify(Array.from(thresholded))),
      dilatedSha256: sha256(JSON.stringify(Array.from(dilated))),
      removedCells: sha256(JSON.stringify(Array.from(removed.cells))),
      removedCount: removed.removed,
    };
  }
  write('codec-image-numerics.json', out);
}

// ── imgToCells end-to-end, per preset ────────────────────────────────────────
{
  const inst = makeInstance(Component, { _srcData: sources['circle-100x80'], _srcW: 100, _srcH: 80 });
  const w = 60, h = 40;
  const out = {};
  for (const preset of ['balanced', 'outline', 'diagram', 'detail']) {
    const r = proto.imgToCells.call(inst, w, h, { preset }, null);
    out[preset] = { cellsSha256: sha256(JSON.stringify(Array.from(r.cells))), box: r.box, removedDots: r.removedDots, dotCount: r.cells.reduce((a, b) => a + b, 0) };
  }
  write('codec-imgtocells.json', { w, h, presets: out });
}

// ── stampText row-height formula cross-check (see codecs test file for the
//    full placement-parity test against a synthetic rasterizer) ─────────────
{
  const cases = [
    { text: 'ABC', opts: {} },
    { text: '안녕', opts: {} },
    { text: 'Hi there', opts: { size: 'small' } },
    { text: '세로', opts: { orient: 'vertical' } },
    { text: 'Big', opts: { size: 'large' } },
  ];
  const out = cases.map((c) => {
    const hasHangul = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(c.text);
    const baseRows = c.opts.size === 'small' ? 7 : c.opts.size === 'large' ? 16 : 11;
    const rows = hasHangul ? Math.round(baseRows * 1.35) : baseRows;
    return { ...c, expectedRows: rows };
  });
  write('codec-tactile-text-rows.json', { cases: out });
}

// ── REAL liblouis translations (same engine + tables the browser uses) ──────
{
  await preload();
  const phrases = [
    { lang: 'ko-g2', text: '안녕하세요' },
    { lang: 'ko-g1', text: '안녕하세요' },
    { lang: 'ko-g2', text: '탁틸 스튜디오' },
    { lang: 'ueb-g1', text: 'hello world' },
    { lang: 'ueb-g2', text: 'hello world' },
    { lang: 'ueb-g1', text: 'The quick brown fox jumps over the lazy dog.' },
    { lang: 'ko-g2', text: '' },
    { lang: 'bogus-lang', text: 'x' },
  ];
  const results = phrases.map((p) => {
    const r = translate(p.text, p.lang);
    return {
      lang: p.lang,
      text: p.text,
      ok: r.ok,
      unicode: r.unicode,
      unicodeCodepoints: [...r.unicode].map((c) => c.codePointAt(0).toString(16)),
      cells: r.cells,
      reason: r.reason ?? null,
      hexForDotPad: r.ok ? brailleUnicodeToHex(padOrTruncate(r.unicode, 20)) : null,
    };
  });
  write('codec-braille-liblouis.json', { results });
}

console.log('codec-b baseline capture complete');
