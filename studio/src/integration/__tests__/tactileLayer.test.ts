import { describe, expect, it } from 'vitest';
import { parseTactileLayer } from '../tactileLayer';
import { frameToHex, docToFrame } from '../../model/frame';

const activeAt = (doc: NonNullable<ReturnType<typeof parseTactileLayer>>, x: number, y: number) =>
  Boolean(doc.cells.find((c) => c.x === x && c.y === y)?.active);

describe('parseTactileLayer — cells shape', () => {
  it('loads a valid cells layer into a dense grid', () => {
    const doc = parseTactileLayer({
      resolution: '60x40',
      cells: [
        { x: 1, y: 1, active: true },
        { x: 2, y: 2, active: false },
      ],
    })!;
    expect(doc.resolution).toBe('60x40');
    expect(doc.cells).toHaveLength(60 * 40); // normalized to dense
    expect(activeAt(doc, 1, 1)).toBe(true);
    expect(activeAt(doc, 2, 2)).toBe(false);
    expect(doc.quality?.activePins).toBe(1);
  });

  it('defaults an unknown resolution to 60×40 and drops out-of-bounds cells', () => {
    const doc = parseTactileLayer({
      resolution: 'huge',
      cells: [
        { x: 5, y: 5, active: true },
        { x: 999, y: 0, active: true }, // dropped
        { x: 0, y: -1, active: true }, // dropped
      ],
    })!;
    expect(doc.resolution).toBe('60x40');
    expect(doc.quality?.activePins).toBe(1);
    expect(activeAt(doc, 5, 5)).toBe(true);
  });

  it('round-trips a hex layer (matches the DTMS codec)', () => {
    const layerDoc = parseTactileLayer({
      resolution: '60x40',
      cells: [{ x: 3, y: 3, active: true }],
    })!;
    const hex = frameToHex(docToFrame(layerDoc));
    const fromHex = parseTactileLayer({ resolution: '60x40', hex })!;
    expect(activeAt(fromHex, 3, 3)).toBe(true);
    expect(fromHex.quality?.activePins).toBe(1);
  });

  it('works at 96×64', () => {
    const doc = parseTactileLayer({ resolution: '96x64', cells: [{ x: 95, y: 63, active: true }] })!;
    expect(doc.cells).toHaveLength(96 * 64);
    expect(activeAt(doc, 95, 63)).toBe(true);
  });
});

describe('parseTactileLayer — invalid input fails safely', () => {
  it('returns null for non-objects and unusable shapes', () => {
    expect(parseTactileLayer(null)).toBeNull();
    expect(parseTactileLayer('nope')).toBeNull();
    expect(parseTactileLayer(42)).toBeNull();
    expect(parseTactileLayer({})).toBeNull(); // no cells, no hex
    expect(parseTactileLayer({ cells: 'bad' })).toBeNull();
    expect(parseTactileLayer({ hex: 'zzzz' })).toBeNull(); // non-hex
  });

  it('an empty cells array yields a valid blank grid', () => {
    const doc = parseTactileLayer({ resolution: '60x40', cells: [] })!;
    expect(doc).not.toBeNull();
    expect(doc.quality?.activePins).toBe(0);
  });
});
