// tools/capture-codecs-baseline.mjs
// Phase 3: record the SHIPPED implementation's codec outputs (DTMS decode,
// Library Asset v1 build/parse, vectorization) as frozen fixtures. The
// extracted src/codecs modules must reproduce every value exactly.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadVendorTW, loadStudioClass, makeInstance,
  seededCells, patternCells, cellsToBitsPlain,
} from './harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'fixtures', 'baseline');
mkdirSync(OUT, { recursive: true });
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const write = (name, data) => {
  writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + '\n');
  console.log('wrote', name);
};

const TW = loadVendorTW();
const FIXED_NOW = Date.UTC(2026, 0, 1);
const { Component } = loadStudioClass({ fixedNow: FIXED_NOW, tw: TW });
const proto = Component.prototype;
const hexOf = (cells, w, h) => TW.encodeBits(cellsToBitsPlain(cells, w, h), w, h);

// ── vectorizeGrid: object arrays from shipped code on seeded/pattern inputs ──
{
  const w = 60, h = 40;
  const inst = makeInstance(Component);
  const scenarios = [
    { name: 'seed-11-sparse', cells: seededCells(w, h, 11, 0.12) },
    { name: 'seed-42-mid', cells: seededCells(w, h, 42, 0.2) },
    { name: 'checker', cells: patternCells(w, h, 'checker') },
    { name: 'diagonal', cells: patternCells(w, h, 'diagonal') },
    { name: 'first-row', cells: patternCells(w, h, 'first-row') },
  ];
  const out = scenarios.map((s) => {
    const r = proto.vectorizeGrid.call(inst, s.cells, w, h, {});
    return { name: s.name, w, h, result: r };
  });
  write('codec-vectorize.json', { scenarios: out });
}

// ── buildLibraryAsset (post-fix, success path) — reuse existing fixture
//    format but now driven through explicit inputs matching the new codec's
//    BuildLibraryAssetInput shape 1:1, plus a corpusCtx-present variant.
{
  const w = 60, h = 40;
  const page1 = seededCells(w, h, 11);
  const page2 = seededCells(w, h, 42);
  const audioMap = { 0: { brl: '⠁⠃⠉', desc: '설명', narration: '나레이션', descMeta: { grade: 2 } } };
  const vectorMap = { 1: [{ type: 'rect', points: [[0, 0]], closed: true, bbox: { x: 0, y: 0, w: 1, h: 1 } }] };

  const runNoCtx = () => {
    const inst = makeInstance(Component, {
      state: { gridW: w, gridH: h, lang: 'ko', brailleLang: 'ko-g1', corpusCtx: null },
      cells: page1, pages: [page1, page2], pageAudio: audioMap, pageVectors: vectorMap,
    });
    return proto.buildLibraryAsset.call(inst, '회귀 픽스처');
  };
  const runWithCtx = () => {
    const ctx = { id: 'dtms-샘플', title: '샘플', category: 'science', tags: ['t1', 't2'], pages: [{ label: 'ctx-p1', desc: 'ctx-desc', braille: 'ctx-brl' }] };
    const inst = makeInstance(Component, {
      state: { gridW: w, gridH: h, lang: 'en', brailleLang: 'ueb-g1', corpusCtx: ctx },
      cells: page2, pages: [page1, page2], pageAudio: {}, pageVectors: {},
    });
    return proto.buildLibraryAsset.call(inst, 'ctx variant');
  };
  write('codec-library-asset.json', {
    fixedNow: FIXED_NOW,
    noCtx: runNoCtx(),
    withCtx: runWithCtx(),
  });
}

// ── assetPagesFromJson: schema-v1 shape, raw-DTMS-export shape, invalid ─────
{
  const inst = makeInstance(Component);
  const w = 60, h = 40;
  const hexA = hexOf(seededCells(w, h, 1), w, h);
  const hexB = hexOf(seededCells(w, h, 2), w, h);

  const schemaV1 = { title: '스키마v1', pages: [{ graphic: hexA, label: 'p1', desc: 'd1' }, { graphic: hexB, label: 'p2' }] };
  const rawDtms = { title: 'raw dtms', items: [{ graphic: { data: hexA }, title: '1쪽' }] };
  const badFormat = { foo: 'bar' };
  const emptyPages = { title: 'empty', pages: [] };
  const invalidHexPages = { title: 'bad hex', pages: [{ graphic: 'zz', label: 'nope' }] };

  write('codec-asset-parse.json', {
    schemaV1: proto.assetPagesFromJson.call(inst, schemaV1),
    rawDtms: proto.assetPagesFromJson.call(inst, rawDtms),
    badFormat: proto.assetPagesFromJson.call(inst, badFormat),
    emptyPages: proto.assetPagesFromJson.call(inst, emptyPages),
    invalidHexPages: proto.assetPagesFromJson.call(inst, invalidHexPages),
    nullInput: proto.assetPagesFromJson.call(inst, null),
  });
}

// ── _textOf / _metaOf normalization cases ────────────────────────────────────
{
  const inst = makeInstance(Component);
  const cases = [
    null, undefined, '', 'plain string', 42, true,
    { text: 'from text' },
    { value: 'from value' },
    { content: 'from content' },
    { ko: '한국어' },
    { label: 'from label' },
    { text: 'with meta', grade: 2, lang: 'ko' },
    { other: 'no known key' },
    [],
    { text: 5 },
  ];
  const out = cases.map((v) => ({
    input: v === undefined ? '__undefined__' : v,
    textOf: proto._textOf.call(inst, v),
    metaOf: proto._metaOf.call(inst, v),
  }));
  write('codec-text-meta.json', { cases: out });
}

// ── local-library (ts.library.v1) save/load round trip ──────────────────────
{
  const w = 60, h = 40;
  const inst = makeInstance(Component);
  const items = [
    { name: 'A', loc: 'drive', grid: '60×40', thumb: 'thumbA', cells: seededCells(w, h, 5) },
    { name: 'B', loc: 'device', grid: '60×40', thumb: '', cells: patternCells(w, h, 'all-on') },
    { name: 'C', loc: 'drive', grid: '96×64', thumb: 'thumbC', cells: seededCells(96, 64, 9) }, // non-native, hex should be ''
  ];
  const saveLibraryImpl = (saved) => {
    const arr = (saved || []).map((it) => {
      const p = String(it.grid || '60×40').split('×'), gw = +p[0] || 60, gh = +p[1] || 40;
      const hex = (gw === 60 && gh === 40 && it.cells) ? hexOf(it.cells, 60, 40) : '';
      return { name: it.name, loc: it.loc, grid: it.grid, thumb: it.thumb || '', hex };
    });
    return arr;
  };
  const saved = saveLibraryImpl(items);
  write('codec-local-library.json', { items: items.map((i) => ({ ...i, cells: undefined })), saved });
}

console.log('codec baseline capture complete');
