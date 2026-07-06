import { describe, expect, it } from 'vitest';
import {
  docToFrame,
  dotBit,
  frameByteLength,
  frameToCells,
  frameToHex,
  hexToFrame,
  type TactileFrame,
} from '../frame';
import { RESOLUTION_DIMS, type TactileDocument, type TactileResolution } from '../../types/tactile';

/** A deterministic pseudo-random bitmap so round-trips cover mixed content. */
function noisyFrame(resolution: TactileResolution): TactileFrame {
  const { width, height } = RESOLUTION_DIMS[resolution];
  const bitmap = new Uint8Array(width * height);
  let h = 2166136261;
  for (let i = 0; i < bitmap.length; i++) {
    h ^= i;
    h = Math.imul(h, 16777619);
    bitmap[i] = (h >>> 7) & 1;
  }
  return { resolution, width, height, bitmap };
}

function docFromFrame(frame: TactileFrame): TactileDocument {
  return {
    id: 't',
    title: 'test',
    resolution: frame.resolution,
    cells: frameToCells(frame),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('dotBit packing', () => {
  it('matches the vanilla engine formula lx*4 + ly', () => {
    expect(dotBit(0, 0)).toBe(0);
    expect(dotBit(0, 3)).toBe(3);
    expect(dotBit(1, 0)).toBe(4);
    expect(dotBit(1, 3)).toBe(7);
  });

  it('encodes a single known pin to the correct bit', () => {
    // Raise the top-left pin of the second (right) column: local (1,0) → bit 4 → 0x10.
    const { width, height } = RESOLUTION_DIMS['60x40'];
    const bitmap = new Uint8Array(width * height);
    bitmap[0 * width + 1] = 1; // x=1, y=0 → cell (0,0), local lx=1 ly=0
    const hex = frameToHex({ resolution: '60x40', width, height, bitmap });
    expect(hex.slice(0, 2)).toBe('10');
  });
});

describe('DTMS byte lengths', () => {
  it('60x40 → 300 bytes / 600 hex chars', () => {
    expect(frameByteLength('60x40')).toBe(300);
    expect(frameToHex(noisyFrame('60x40')).length).toBe(600);
  });

  it('96x64 → 768 bytes / 1536 hex chars', () => {
    expect(frameByteLength('96x64')).toBe(768);
    expect(frameToHex(noisyFrame('96x64')).length).toBe(1536);
  });
});

describe.each<TactileResolution>(['60x40', '96x64'])('round-trip %s', (res) => {
  it('bitmap → hex → bitmap is identical', () => {
    const original = noisyFrame(res);
    const decoded = hexToFrame(frameToHex(original), res);
    expect(Array.from(decoded.bitmap)).toEqual(Array.from(original.bitmap));
  });

  it('doc → frame → cells → frame preserves active pins', () => {
    const original = noisyFrame(res);
    const doc = docFromFrame(original);
    const roundTripped = docToFrame(doc);
    expect(Array.from(roundTripped.bitmap)).toEqual(Array.from(original.bitmap));
  });
});
