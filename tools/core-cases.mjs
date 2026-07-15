// Shared deterministic case scripts for the Phase 2 core baselines and the
// parity tests. Kept separate from capture-core-baseline.mjs so importing the
// cases never re-runs the capture.
import { mulberry32 } from './harness.mjs';

export function geometryCases() {
  const rnd = mulberry32(0xC0DE);
  const pt = (w, h) => [Math.floor(rnd() * w), Math.floor(rnd() * h)];
  const cases = [];
  for (const [w, h] of [[60, 40], [96, 64]]) {
    for (let i = 0; i < 6; i++) {
      const [x0, y0] = pt(w, h), [x1, y1] = pt(w, h);
      cases.push({ w, h, x0, y0, x1, y1 });
    }
  }
  cases.push({ w: 60, h: 40, x0: 5, y0: 5, x1: 5, y1: 5 });
  cases.push({ w: 60, h: 40, x0: 0, y0: 0, x1: 59, y1: 39 });
  cases.push({ w: 60, h: 40, x0: 59, y0: 0, x1: 0, y1: 39 });
  return cases;
}

export function pageScript() {
  return [
    { op: 'add' },
    { op: 'add' },
    { op: 'meta', page: 0, tag: 'a0' },
    { op: 'meta', page: 2, tag: 'a2' },
    { op: 'move', from: 2, to: 0 },
    { op: 'add' },
    { op: 'delete', idx: 1 },
    { op: 'delete', idx: 0 },
    { op: 'move', from: 0, to: 5 },
    { op: 'delete', idx: 0 },
    { op: 'delete', idx: 0 },
  ];
}
