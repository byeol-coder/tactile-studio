// tests/unit/edge-hysteresis.test.ts
// Property tests for the double-threshold (hysteresis) edge step added to the
// image converter. The codecs-b parity suite pins imgToCells output byte-for-
// byte; these assert the *reasons* the change was made — additivity (strong
// edges are never lost), gap bridging (a faint arc connected to a strong edge
// gets reconnected), and noise rejection (an isolated weak blob stays off).

import { describe, it, expect } from 'vitest';
import { cvHysteresis } from '../../src/codecs/image/image.js';

const idx = (x: number, y: number, w: number) => y * w + x;

describe('edge hysteresis', () => {
  it('is additive: output is a superset of the single strong-threshold cut', () => {
    const w = 20, h = 12, norm = new Float32Array(w * h);
    // pseudo-random but deterministic edge field
    for (let i = 0; i < norm.length; i++) norm[i] = (i * 73 + 11) % 256;
    const hi = 90, lo = 140;
    const out = cvHysteresis(norm, w, h, hi, lo);
    for (let i = 0; i < norm.length; i++) {
      if (norm[i] < hi) expect(out[i], `strong pixel ${i} must stay on`).toBe(1);
    }
  });

  it('bridges a faint gap between two strong edge runs', () => {
    const w = 12, h = 3, norm = new Float32Array(w * h).fill(255); // 255 = no edge
    const y = 1;
    // strong run … weak bridge … strong run, all on one row
    for (let x = 0; x < 4; x++) norm[idx(x, y, w)] = 10;      // strong (seed)
    for (let x = 4; x < 8; x++) norm[idx(x, y, w)] = 120;     // weak, connected
    for (let x = 8; x < 12; x++) norm[idx(x, y, w)] = 10;     // strong (seed)
    const out = cvHysteresis(norm, w, h, 90, 140);
    // the whole row should now be a single connected run
    for (let x = 0; x < 12; x++) expect(out[idx(x, y, w)], `x=${x} bridged`).toBe(1);
  });

  it('does NOT switch on a weak blob that is not connected to any strong edge', () => {
    const w = 12, h = 5, norm = new Float32Array(w * h).fill(255);
    // isolated weak cluster far from any seed
    for (const [x, y] of [[8, 3], [9, 3], [8, 4], [9, 4]] as const) norm[idx(x, y, w)] = 120;
    // a strong seed in the opposite corner
    norm[idx(1, 1, w)] = 10;
    const out = cvHysteresis(norm, w, h, 90, 140);
    expect(out[idx(1, 1, w)]).toBe(1);                 // seed on
    for (const [x, y] of [[8, 3], [9, 3], [8, 4], [9, 4]] as const)
      expect(out[idx(x, y, w)], `weak blob ${x},${y} stays off`).toBe(0);
  });
});
