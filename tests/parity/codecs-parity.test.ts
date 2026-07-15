// Phase 3 parity + round-trip suite for src/codecs/*.
// Baselines in tests/fixtures/baseline/codec-*.json were captured from the
// SHIPPED implementation (tools/capture-codecs-baseline.mjs). Geometry-style
// exact object comparisons are used throughout — no snapshot-only checks.
import { describe, it, expect, beforeAll } from 'vitest';
import {
  loadVendorTW, loadStudioClass, makeInstance,
  seededCells, patternCells, cellsToBitsPlain,
} from '../../tools/harness.mjs';
import {
  decodeDtms60x40Hex, encodeDtmsHex, isDtms60x40RoundTripSafe, DTMS_60X40_HEX_LENGTH,
} from '../../src/codecs/dtms/dtms.js';
import { vectorizeGrid } from '../../src/codecs/vector/vectorize.js';
import {
  textOf, metaOf, buildLibraryAssetV1, parseLibraryAssetPages,
} from '../../src/codecs/library-asset-v1/library-asset-v1.js';
import { toSavedRecords, fromSavedRecords } from '../../src/codecs/document/local-library.js';

import vecFix from '../fixtures/baseline/codec-vectorize.json';
import libFix from '../fixtures/baseline/codec-library-asset.json';
import parseFix from '../fixtures/baseline/codec-asset-parse.json';
import textMetaFix from '../fixtures/baseline/codec-text-meta.json';
import localLibFix from '../fixtures/baseline/codec-local-library.json';

let TW: any;
let Component: any;
let proto: any;

beforeAll(() => {
  TW = loadVendorTW();
  ({ Component } = loadStudioClass({ fixedNow: libFix.fixedNow, tw: TW }));
  proto = Component.prototype;
});

const hexOf = (cells: Uint8Array, w: number, h: number) =>
  TW.encodeBits(cellsToBitsPlain(cells, w, h), w, h) as string;

// ── DTMS codec ───────────────────────────────────────────────────────────────
describe('DTMS codec (decode + injected encode)', () => {
  it('decode matches the shipped corpusCellsFromHex for seeded pages', () => {
    const inst = makeInstance(Component);
    for (const seed of [1, 11, 42]) {
      const cells = seededCells(60, 40, seed);
      const hex = hexOf(cells, 60, 40);
      const shipped = proto.corpusCellsFromHex.call(inst, hex);
      const extracted = decodeDtms60x40Hex(hex);
      expect(Array.from(extracted!)).toEqual(Array.from(shipped));
    }
  });

  it('rejects invalid input exactly like the shipped decoder (returns null, never raw)', () => {
    const inst = makeInstance(Component);
    for (const bad of ['', 'zz', '0'.repeat(599), 'g'.repeat(600), null, undefined, 123]) {
      expect(decodeDtms60x40Hex(bad)).toBeNull();
      expect(proto.corpusCellsFromHex.call(inst, bad)).toBeNull();
    }
  });

  it('rejects a valid 96×64 (1536-char) hex — hardcoded to 60×40, not generalized', () => {
    const hex96 = hexOf(seededCells(96, 64, 3), 96, 64);
    expect(hex96.length).toBe(1536);
    expect(decodeDtms60x40Hex(hex96)).toBeNull();
  });

  it('encode(via injected TW) + decode round-trips value-for-value', () => {
    for (const seed of [7, 20260101]) {
      const cells = seededCells(60, 40, seed);
      expect(isDtms60x40RoundTripSafe(TW.encodeBits, cells)).toBe(true);
      const hex = encodeDtmsHex(TW.encodeBits, cells, 60, 40);
      expect(hex.length).toBe(DTMS_60X40_HEX_LENGTH);
      expect(Array.from(decodeDtms60x40Hex(hex)!)).toEqual(Array.from(cells));
    }
  });
});

// ── vectorization codec ──────────────────────────────────────────────────────
describe('vectorize codec parity', () => {
  it('reproduces the shipped vectorizeGrid objects and stats exactly', () => {
    const w = 60, h = 40;
    const scenarios: Record<string, Uint8Array> = {
      'seed-11-sparse': seededCells(w, h, 11, 0.12),
      'seed-42-mid': seededCells(w, h, 42, 0.2),
      checker: patternCells(w, h, 'checker'),
      diagonal: patternCells(w, h, 'diagonal'),
      'first-row': patternCells(w, h, 'first-row'),
    };
    for (const fix of vecFix.scenarios) {
      const cells = scenarios[fix.name];
      const result = vectorizeGrid(cells, w, h, {});
      expect(result).toEqual(fix.result);
    }
  });

  it('cross-checks against the live shipped vectorizeGrid for a fresh seed', () => {
    const inst = makeInstance(Component);
    const w = 60, h = 40;
    const cells = seededCells(w, h, 999, 0.15);
    const shipped = proto.vectorizeGrid.call(inst, cells, w, h, {});
    const extracted = vectorizeGrid(cells, w, h, {});
    expect(extracted).toEqual(shipped);
  });

  it('never throws on a pathological (all-on) input', () => {
    const w = 60, h = 40;
    const result = vectorizeGrid(patternCells(w, h, 'all-on'), w, h, {});
    expect(result.stats.error).toBeUndefined();
  });
});

// ── text/meta normalization ──────────────────────────────────────────────────
describe('textOf / metaOf normalization', () => {
  it('matches the shipped _textOf / _metaOf for every case', () => {
    for (const c of textMetaFix.cases) {
      const input = c.input === '__undefined__' ? undefined : c.input;
      expect(textOf(input)).toBe(c.textOf);
      expect(metaOf(input)).toEqual(c.metaOf);
    }
  });
});

// ── Library Asset v1 build (export) ──────────────────────────────────────────
describe('buildLibraryAssetV1 parity', () => {
  const convQuality = (cells: Uint8Array, w: number, h: number) => {
    // same formula as monolith convQuality, only the `key` field is consumed
    let dots = 0; for (let i = 0; i < cells.length; i++) dots += cells[i];
    const density = dots / (w * h);
    let isolated = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!cells[y * w + x]) continue;
      let nb = 0;
      if (x > 0 && cells[y * w + x - 1]) nb++;
      if (x < w - 1 && cells[y * w + x + 1]) nb++;
      if (y > 0 && cells[(y - 1) * w + x]) nb++;
      if (y < h - 1 && cells[(y + 1) * w + x]) nb++;
      if (nb === 0) isolated++;
    }
    let key = 'readable';
    if (density < 0.03) key = 'tooSparse';
    else if (density > 0.40) key = 'tooDense';
    else if (dots > 0 && isolated / dots > 0.25) key = 'manyIsolated';
    return { key };
  };
  const banaCheck = (cells: Uint8Array, w: number, h: number) => {
    const q = convQuality(cells, w, h) as any;
    // recompute dots/isolated locally (banaPrintCheck reuses convQuality's fuller shape)
    let dots = 0; for (let i = 0; i < cells.length; i++) dots += cells[i];
    const density = dots / (w * h);
    let isolated = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!cells[y * w + x]) continue;
      let nb = 0;
      if (x > 0 && cells[y * w + x - 1]) nb++;
      if (x < w - 1 && cells[y * w + x + 1]) nb++;
      if (y > 0 && cells[(y - 1) * w + x]) nb++;
      if (y < h - 1 && cells[(y + 1) * w + x]) nb++;
      if (nb === 0) isolated++;
    }
    const issues: string[] = [];
    if (!dots) issues.push('empty');
    if (density > 0.40) issues.push('tooDense');
    if (dots > 0 && isolated / dots > 0.25) issues.push('manyIsolated');
    return { pass: issues.length === 0 };
  };

  it('no-corpus-context variant matches the shipped output byte-for-byte', () => {
    const w = 60, h = 40;
    const page1 = seededCells(w, h, 11);
    const page2 = seededCells(w, h, 42);
    const asset = buildLibraryAssetV1({
      name: '회귀 픽스처',
      gridW: w, gridH: h, lang: 'ko', brailleLang: 'ko-g1',
      activeCells: page1,
      pages: [page1, page2],
      pageAudio: { 0: { brl: '⠁⠃⠉', desc: '설명', narration: '나레이션', descMeta: { grade: 2 } } },
      pageVectors: { 1: [{ type: 'rect', points: [[0, 0]], closed: true, bbox: { x: 0, y: 0, w: 1, h: 1 } }] },
      corpusCtx: null,
    }, { encodeBits: TW.encodeBits, convQuality, banaCheck, now: libFix.fixedNow });
    expect(asset).toEqual(libFix.noCtx);
  });

  it('corpus-context variant (category/lang/tags/derivedFrom) matches shipped output', () => {
    const w = 60, h = 40;
    const page1 = seededCells(w, h, 11);
    const page2 = seededCells(w, h, 42);
    const ctx = { id: 'dtms-샘플', title: '샘플', category: 'science', tags: ['t1', 't2'], pages: [{ label: 'ctx-p1', desc: 'ctx-desc', braille: 'ctx-brl' }] };
    const asset = buildLibraryAssetV1({
      name: 'ctx variant',
      gridW: w, gridH: h, lang: 'en', brailleLang: 'ueb-g1',
      activeCells: page2,
      pages: [page1, page2],
      pageAudio: {},
      pageVectors: {},
      corpusCtx: ctx,
    }, { encodeBits: TW.encodeBits, convQuality, banaCheck, now: libFix.fixedNow });
    expect(asset).toEqual(libFix.withCtx);
  });
});

// ── Library Asset v1 parse (import) ──────────────────────────────────────────
describe('parseLibraryAssetPages parity', () => {
  it('parses schema-v1 shape identically to the shipped assetPagesFromJson', () => {
    const inst = makeInstance(Component);
    const w = 60, h = 40;
    const hexA = hexOf(seededCells(w, h, 1), w, h);
    const hexB = hexOf(seededCells(w, h, 2), w, h);
    const obj = { title: '스키마v1', pages: [{ graphic: hexA, label: 'p1', desc: 'd1' }, { graphic: hexB, label: 'p2' }] };
    const shipped = proto.assetPagesFromJson.call(inst, obj);
    const extracted = parseLibraryAssetPages(obj);
    expect(extracted?.title).toBe(shipped.title);
    expect(extracted?.pages.length).toBe(shipped.pages.length);
    extracted!.pages.forEach((p, i) => {
      expect(p.label).toBe(shipped.pages[i].label);
      expect(Array.from(p.cells)).toEqual(Array.from(shipped.pages[i].cells));
    });
    // also matches the frozen baseline
    expect(extracted?.title).toBe(parseFix.schemaV1.title);
    expect(extracted?.pages.map((p) => p.label)).toEqual(parseFix.schemaV1.pages.map((p: any) => p.label));
  });

  it('parses raw-DTMS-export shape (items[].graphic.data)', () => {
    const w = 60, h = 40;
    const hexA = hexOf(seededCells(w, h, 1), w, h);
    const obj = { title: 'raw dtms', items: [{ graphic: { data: hexA }, title: '1쪽' }] };
    const parsed = parseLibraryAssetPages(obj);
    expect(parsed).not.toBeNull();
    expect(parsed?.pages.length).toBe(parseFix.rawDtms.pages.length);
    expect(parsed?.pages[0].label).toBe(parseFix.rawDtms.pages[0].label);
  });

  it('returns null for unrecognized shape, empty pages, all-invalid-hex pages, and null input', () => {
    expect(parseLibraryAssetPages({ foo: 'bar' })).toBeNull();
    expect(parseFix.badFormat).toBeNull();
    expect(parseLibraryAssetPages({ title: 'empty', pages: [] })).toBeNull();
    expect(parseFix.emptyPages).toBeNull();
    expect(parseLibraryAssetPages({ title: 'bad hex', pages: [{ graphic: 'zz', label: 'nope' }] })).toBeNull();
    expect(parseFix.invalidHexPages).toBeNull();
    expect(parseLibraryAssetPages(null)).toBeNull();
    expect(parseFix.nullInput).toBeNull();
  });

  it('import(export(document)) round-trips a document losslessly (pages + hex)', () => {
    const w = 60, h = 40;
    const original = [seededCells(w, h, 100), seededCells(w, h, 200)];
    const asset = buildLibraryAssetV1({
      name: 'roundtrip', gridW: w, gridH: h, lang: 'ko', brailleLang: 'ko-g1',
      activeCells: original[0], pages: original, pageAudio: {}, pageVectors: {}, corpusCtx: null,
    }, {
      encodeBits: TW.encodeBits,
      convQuality: () => ({ key: 'readable' }),
      banaCheck: () => ({ pass: true }),
      now: 1700000000000,
    });
    const parsed = parseLibraryAssetPages(asset);
    expect(parsed).not.toBeNull();
    expect(parsed!.pages.length).toBe(original.length);
    parsed!.pages.forEach((p, i) => expect(Array.from(p.cells)).toEqual(Array.from(original[i])));
  });
});

// ── local-library (ts.library.v1) codec ──────────────────────────────────────
describe('local-library (ts.library.v1) save/load parity', () => {
  it('toSavedRecords matches the shipped saveLibrary output', () => {
    const w = 60, h = 40;
    const items = [
      { name: 'A', loc: 'drive', grid: '60×40', thumb: 'thumbA', cells: seededCells(w, h, 5) },
      { name: 'B', loc: 'device', grid: '60×40', thumb: '', cells: patternCells(w, h, 'all-on') },
      { name: 'C', loc: 'drive', grid: '96×64', thumb: 'thumbC', cells: seededCells(96, 64, 9) },
    ];
    const saved = toSavedRecords(items, TW.encodeBits);
    expect(saved).toEqual(localLibFix.saved);
    // non-native grid must keep an empty hex, exactly like production
    expect(saved[2].hex).toBe('');
  });

  it('fromSavedRecords(toSavedRecords(items)) round-trips 60×40 cells exactly', () => {
    const w = 60, h = 40;
    const items = [
      { name: 'A', loc: 'drive', grid: '60×40', thumb: 'thumbA', cells: seededCells(w, h, 5) },
      { name: 'B', loc: 'device', grid: '60×40', thumb: '', cells: patternCells(w, h, 'all-on') },
    ];
    const saved = toSavedRecords(items, TW.encodeBits);
    const loaded = fromSavedRecords(JSON.stringify(saved));
    loaded.forEach((it, i) => expect(Array.from(it.cells)).toEqual(Array.from(items[i].cells)));
  });

  it('tolerates malformed/legacy input exactly like the shipped loadLibrary', () => {
    expect(fromSavedRecords('not json')).toEqual([]);
    expect(fromSavedRecords('{}')).toEqual([]);
    expect(fromSavedRecords(JSON.stringify([{ name: 'legacy-no-hex' }]))[0].cells.length).toBe(2400);
  });
});
