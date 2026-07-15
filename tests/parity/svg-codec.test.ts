// Parity test for src/codecs/svg — thin orchestration over the injected
// vendor TW.bitsToSVG (vendor/tw/pins.js), compared against the live
// shipped function.
import { describe, it, expect } from 'vitest';
import { loadVendorTW, seededCells, patternCells } from '../../tools/harness.mjs';
import { encodeSvg } from '../../src/codecs/svg/svg.js';

describe('encodeSvg parity', () => {
  it('matches the shipped TW.bitsToSVG output exactly for seeded/pattern pages', () => {
    const TW = loadVendorTW();
    const w = 60, h = 40;
    const cases = [seededCells(w, h, 11), seededCells(w, h, 42, 0.1), patternCells(w, h, 'checker'), patternCells(w, h, 'all-off')];
    for (const cells of cases) {
      const extracted = encodeSvg(TW.bitsToSVG, cells, w, h, { title: 'test' });
      const bits = new Array(h);
      for (let y = 0; y < h; y++) { const row = new Array(w); for (let x = 0; x < w; x++) row[x] = !!cells[y * w + x]; bits[y] = row; }
      const shipped = TW.bitsToSVG(bits, w, h, { title: 'test' });
      expect(extracted).toBe(shipped);
    }
  });

  it('produces a well-formed SVG string with a white background rect and black dots', () => {
    const TW = loadVendorTW();
    const svg = encodeSvg(TW.bitsToSVG, patternCells(60, 40, 'first-row'), 60, 40, { title: 'x' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toMatch(/<circle/);
  });
});
