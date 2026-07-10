// Parity test for src/codecs/quality — extracted alongside the Phase 5
// export dialog, which needs these for Library Asset v1 graphicFeatures.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadVendorTW, loadStudioClass, makeInstance, seededCells, patternCells } from '../../tools/harness.mjs';
import { convQuality, banaPrintCheck } from '../../src/codecs/quality/quality.js';

let Component: any;
let proto: any;
beforeAll(() => {
  const TW = loadVendorTW();
  ({ Component } = loadStudioClass({ tw: TW }));
  proto = Component.prototype;
});

describe('quality codec parity', () => {
  it('convQuality matches the shipped method across sparse/dense/isolated/empty inputs', () => {
    const inst = makeInstance(Component);
    const w = 60, h = 40;
    const cases = [
      seededCells(w, h, 1, 0.01),
      seededCells(w, h, 2, 0.2),
      patternCells(w, h, 'all-on'),
      patternCells(w, h, 'all-off'),
      patternCells(w, h, 'checker'),
    ];
    for (const cells of cases) {
      const extracted = convQuality(cells, w, h);
      const shipped = proto.convQuality.call(inst, cells, w, h);
      expect(extracted).toEqual(shipped);
    }
  });

  it('banaPrintCheck matches the shipped method (post banaPrintCheck-fix)', () => {
    const inst = makeInstance(Component);
    const w = 60, h = 40;
    const cases = [
      patternCells(w, h, 'all-off'),
      patternCells(w, h, 'all-on'),
      seededCells(w, h, 11, 0.15),
    ];
    for (const cells of cases) {
      expect(banaPrintCheck(cells, w, h)).toEqual(proto.banaPrintCheck.call(inst, cells, w, h));
    }
  });
});
