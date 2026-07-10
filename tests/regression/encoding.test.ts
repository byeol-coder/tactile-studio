// Exact-value regression tests for the compatibility-critical dot encoding.
// Compares live production code (loaded via tools/harness.mjs) against frozen
// fixtures in tests/fixtures/baseline/. Never update fixtures to go green.
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import {
  loadVendorTW, loadStudioClass, makeInstance,
  seededCells, patternCells, cellsToBitsPlain,
} from '../../tools/harness.mjs';
import cellMapping from '../fixtures/baseline/cell-mapping.json';
import encode60 from '../fixtures/baseline/encode-60x40.json';
import encode96 from '../fixtures/baseline/encode-96x64.json';
import roundtrip from '../fixtures/baseline/decode-roundtrip.json';
import bridge from '../fixtures/baseline/cells-bits-bridge.json';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

let TW: any;
let Component: any;
let proto: any;

beforeAll(() => {
  TW = loadVendorTW();
  ({ Component } = loadStudioClass({ tw: TW }));
  proto = Component.prototype;
});

describe('dotBit = lx * 4 + ly (2×4 packing, EA column-first order)', () => {
  it('CELL mapping table is byte-identical to baseline', () => {
    expect(TW.CELL).toEqual(cellMapping.CELL);
  });

  it('single-dot probes reproduce the exact packed byte', () => {
    for (const p of cellMapping.probes) {
      const cells = new Uint8Array(60 * 40);
      cells[p.ly * 60 + p.lx] = 1;
      const hex = TW.encodeBits(cellsToBitsPlain(cells, 60, 40), 60, 40);
      expect(p.expectedBit).toBe(p.lx * 4 + p.ly);
      expect(hex.slice(0, 2)).toBe(p.firstByteHex);
      expect(hex.length).toBe(p.hexLength);
      // packed byte must be exactly 1 << dotBit
      expect(parseInt(p.firstByteHex, 16)).toBe(1 << p.expectedBit);
    }
  });
});

function encodeSuite(fix: typeof encode60) {
  const { w, h } = fix;
  it(`${w}×${h}: pattern hex outputs are byte-identical`, () => {
    for (const pat of fix.patterns) {
      const hex = TW.encodeBits(cellsToBitsPlain(patternCells(w, h, pat.kind), w, h), w, h);
      expect(hex.length).toBe(fix.expectedHexLength);
      expect(hex).toBe(pat.hex);
    }
  });
  it(`${w}×${h}: seeded random pages match recorded hashes`, () => {
    for (const s of fix.seeded) {
      const cells = seededCells(w, h, s.seed, s.density);
      expect(cells.reduce((a: number, b: number) => a + b, 0)).toBe(s.pinCount);
      const hex = TW.encodeBits(cellsToBitsPlain(cells, w, h), w, h);
      expect(hex.length).toBe(s.hexLength);
      expect(sha256(hex)).toBe(s.hexSha256);
    }
  });
}

describe('600-hex output (60×40)', () => encodeSuite(encode60));
describe('96×64 output (dotpad768)', () => encodeSuite(encode96 as typeof encode60));

describe('corpusCellsFromHex decode + round trip', () => {
  it('decode(encode(cells)) is value-for-value identical', () => {
    const inst = makeInstance(Component);
    for (const c of roundtrip.cases) {
      const cells = seededCells(60, 40, c.seed);
      const hex = TW.encodeBits(cellsToBitsPlain(cells, 60, 40), 60, 40);
      const decoded = proto.corpusCellsFromHex.call(inst, hex);
      expect(decoded).not.toBeNull();
      expect(Array.from(decoded)).toEqual(Array.from(cells));
      expect(decoded.reduce((a: number, b: number) => a + b, 0)).toBe(c.decodedPinCount);
      expect(c.identical).toBe(true);
    }
  });

  it('invalid input always returns null (never raw fallback)', () => {
    const inst = makeInstance(Component);
    const bad = ['', 'zz', '0'.repeat(599), 'g'.repeat(600), null];
    bad.forEach((v, i) => {
      expect(proto.corpusCellsFromHex.call(inst, v)).toBeNull();
      expect(roundtrip.invalids[i].returnsNull).toBe(true);
    });
  });
});

describe('cellsToBits / bitsToCells bridge (96×64)', () => {
  it('round trips and hashes to the recorded value', () => {
    const inst = makeInstance(Component);
    const { w, h, seed } = bridge;
    const cells = seededCells(w, h, seed);
    const bits = proto.cellsToBits.call(inst, cells, w, h);
    const back = proto.bitsToCells.call(inst, bits, w, h);
    expect(Array.from(back)).toEqual(Array.from(cells));
    expect(sha256(TW.encodeBits(bits, w, h))).toBe(bridge.hexSha256);
    expect(bridge.roundTripIdentical).toBe(true);
  });
});
