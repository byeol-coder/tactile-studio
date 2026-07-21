// tests/unit/line-weight-denoise.test.ts
//
// Covers the new codec additions backing the "선 굵기" (line weight) and
// "노이즈 제거" (denoise) controls added to ImportDialog: cvErode (dual of
// the existing cvDilate), thickenBits (signed multi-pass wrapper), and
// denoiseBits (named wrapper over the existing cvRemoveSmall).

import { describe, it, expect } from 'vitest';
import { cvDilate, cvErode, thickenBits, denoiseBits, cvRemoveSmall } from '../../src/codecs/image/image.js';

function solidBlock(w: number, h: number, x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const cells = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cells[y * w + x] = 1;
  return cells;
}

function count(cells: Uint8Array): number {
  return cells.reduce((n, v) => n + v, 0);
}

describe('cvErode — dual of cvDilate', () => {
  it('shrinks a solid block from all sides (opposite of dilate growing it)', () => {
    const w = 10, h = 10;
    const block = solidBlock(w, h, 3, 3, 7, 7); // 4x4 = 16 on
    const eroded = cvErode(block, w, h);
    const dilated = cvDilate(block, w, h);
    expect(count(eroded)).toBeLessThan(count(block));
    expect(count(dilated)).toBeGreaterThan(count(block));
  });

  it('erodes away a single isolated pixel entirely', () => {
    const w = 5, h = 5;
    const cells = new Uint8Array(w * h);
    cells[2 * w + 2] = 1;
    expect(count(cvErode(cells, w, h))).toBe(0);
  });

  it('treats out-of-bounds neighbors as off, eroding the border', () => {
    const w = 4, h = 4;
    const cells = new Uint8Array(w * h).fill(1); // fully solid, touches every edge
    const eroded = cvErode(cells, w, h);
    // Only interior pixels (none, in a 4x4 with 3x3 neighborhoods needing
    // in-bounds neighbors on all sides) can survive — corners/edges cannot.
    expect(eroded[0]).toBe(0); // corner
    expect(eroded[1 * w + 1]).toBe(1); // true interior of a 4x4 survives
  });
});

describe('thickenBits — signed line-weight control', () => {
  const w = 12, h = 12;
  const base = solidBlock(w, h, 4, 4, 8, 8); // 4x4 = 16

  it('level 0 is a no-op', () => {
    expect(thickenBits(base, w, h, 0)).toEqual(base);
  });

  it('positive levels dilate — more dots than the base, monotonically with level', () => {
    const thick = thickenBits(base, w, h, 1);
    const thicker = thickenBits(base, w, h, 2);
    expect(count(thick)).toBeGreaterThan(count(base));
    expect(count(thicker)).toBeGreaterThan(count(thick));
  });

  it('negative levels erode — fewer dots than the base', () => {
    const thin = thickenBits(base, w, h, -1);
    expect(count(thin)).toBeLessThan(count(base));
  });

  it('two dilate passes equal calling cvDilate twice directly', () => {
    const viaThicken = thickenBits(base, w, h, 2);
    const viaDilateTwice = cvDilate(cvDilate(base, w, h), w, h);
    expect(viaThicken).toEqual(viaDilateTwice);
  });
});

describe('denoiseBits — named wrapper over cvRemoveSmall', () => {
  it('removes small isolated clusters below the minSize threshold', () => {
    const w = 10, h = 10;
    const cells = new Uint8Array(w * h);
    cells[1 * w + 1] = 1; // isolated single dot (size 1)
    const denoised = denoiseBits(cells, w, h, 3);
    expect(count(denoised)).toBe(0);
  });

  it('keeps clusters at or above minSize, matching cvRemoveSmall directly', () => {
    const w = 10, h = 10;
    const cells = solidBlock(w, h, 5, 5, 5 + 2, 5 + 2); // 2x2 = 4 connected (4-conn: all touch)
    const denoised = denoiseBits(cells, w, h, 3);
    const { cells: viaRemoveSmall } = cvRemoveSmall(cells, w, h, 3);
    expect(denoised).toEqual(viaRemoveSmall);
    expect(count(denoised)).toBe(4);
  });

  it('defaults minSize to 3 when not passed', () => {
    const w = 10, h = 10;
    const cells = new Uint8Array(w * h);
    cells[1 * w + 1] = 1;
    cells[1 * w + 2] = 1; // 2-pixel cluster, below default minSize 3
    expect(count(denoiseBits(cells, w, h))).toBe(0);
  });
});
