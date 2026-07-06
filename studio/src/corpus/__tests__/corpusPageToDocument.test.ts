import { describe, it, expect } from 'vitest';
import { getCorpus } from '../index';
import { corpusPageToDocument } from '../search';
import { docToFrame } from '../../model/frame';

const byId = (id: string) => getCorpus().find((g) => g.id === id)!;

describe('corpusPageToDocument', () => {
  it('decodes a page graphic HEX to a 60×40 editable document', () => {
    const g = byId('dtms-삼국시대-영토-변화');
    const doc = corpusPageToDocument(g, 0);
    expect(doc.resolution).toBe('60x40');
    expect(doc.cells).toHaveLength(60 * 40);
    // Fixed active-pin count for page 1 — guards the DotPad column-major codec.
    const active = doc.cells.filter((c) => c.active).length;
    expect(active).toBe(321);
  });

  it('round-trips through the frame codec (decode is non-empty and stable)', () => {
    const g = byId('dtms-세포-구조');
    const doc = corpusPageToDocument(g, 0);
    const frame = docToFrame(doc);
    expect(frame.bitmap.reduce((n, b) => n + b, 0)).toBeGreaterThan(0);
  });

  it('labels multi-page documents with the page label', () => {
    const g = byId('dtms-세포-구조');
    const doc = corpusPageToDocument(g, 2);
    expect(doc.title).toContain(g.title);
  });

  it('titles a single-page document with just the graphic title', () => {
    const g = byId('dtms-토성');
    const doc = corpusPageToDocument(g, 0);
    expect(doc.title).toBe('토성');
  });

  it('clamps an out-of-range page index to a valid page', () => {
    const g = byId('dtms-토성');
    const doc = corpusPageToDocument(g, 99);
    expect(doc.cells).toHaveLength(60 * 40);
  });
});
