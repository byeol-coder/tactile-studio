// tools/capture-baseline.mjs
// Phase 1: capture CURRENT production outputs as exact-value fixtures.
//
// Run once against a known-good working tree:
//   npm run capture:baseline
//
// The resulting JSON files under tests/fixtures/baseline/ are the frozen
// source of truth for the migration. They must NOT be regenerated to make a
// failing suite green — a diff here means behavior changed and must be
// reviewed as a (potential) compatibility break.

import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadVendorTW, loadCorpus, loadStudioClass, makeInstance,
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
const FIXED_NOW = Date.UTC(2026, 0, 1); // deterministic timestamps for fixtures
const { Component } = loadStudioClass({ fixedNow: FIXED_NOW, tw: TW });
const proto = Component.prototype;

// ── 1. cell mapping / dotBit ─────────────────────────────────────────────────
// Probe each of the 8 dots of cell(0,0) individually and record the encoded
// first byte → proves dotBit = lx*4+ly and the EA column-first CELL order.
{
  const probes = [];
  for (let ly = 0; ly < 4; ly++) for (let lx = 0; lx < 2; lx++) {
    const cells = new Uint8Array(60 * 40);
    cells[ly * 60 + lx] = 1;
    const hex = TW.encodeBits(cellsToBitsPlain(cells, 60, 40), 60, 40);
    probes.push({ lx, ly, expectedBit: lx * 4 + ly, firstByteHex: hex.slice(0, 2), hexLength: hex.length });
  }
  write('cell-mapping.json', { CELL: TW.CELL, probes });
}

// ── 2. encodeBits outputs for 60×40 and 96×64 ───────────────────────────────
function encodeSuite(w, h) {
  const kinds = ['all-off', 'all-on', 'checker', 'first-row', 'first-col', 'diagonal'];
  const patterns = kinds.map((kind) => ({
    kind,
    hex: TW.encodeBits(cellsToBitsPlain(patternCells(w, h, kind), w, h), w, h),
  }));
  const seeded = [11, 42, 20260101].map((seed) => {
    const cells = seededCells(w, h, seed);
    return {
      seed,
      density: 0.35,
      pinCount: cells.reduce((a, b) => a + b, 0),
      hexSha256: sha256(TW.encodeBits(cellsToBitsPlain(cells, w, h), w, h)),
      hexLength: TW.encodeBits(cellsToBitsPlain(cells, w, h), w, h).length,
    };
  });
  return { w, h, expectedHexLength: (w / 2) * (h / 4) * 2, patterns, seeded };
}
write('encode-60x40.json', encodeSuite(60, 40));
write('encode-96x64.json', encodeSuite(96, 64));

// ── 3. decode round trip (Component.corpusCellsFromHex, 60×40 only) ─────────
{
  const inst = makeInstance(Component);
  const cases = [];
  for (const seed of [11, 42, 20260101]) {
    const cells = seededCells(60, 40, seed);
    const hex = TW.encodeBits(cellsToBitsPlain(cells, 60, 40), 60, 40);
    const decoded = proto.corpusCellsFromHex.call(inst, hex);
    const identical = decoded && decoded.length === cells.length &&
      decoded.every((v, i) => v === cells[i]);
    cases.push({ seed, identical: !!identical, decodedPinCount: decoded ? decoded.reduce((a, b) => a + b, 0) : null });
  }
  const invalids = ['', 'zz', '0'.repeat(599), 'g'.repeat(600), null].map((v, i) => ({
    case: i, returnsNull: proto.corpusCellsFromHex.call(inst, v) === null,
  }));
  write('decode-roundtrip.json', { cases, invalids });
}

// ── 4. corpus fixtures (real shipped DTMS data) ──────────────────────────────
{
  const corpus = loadCorpus();
  const inst = makeInstance(Component);
  const records = corpus.slice(0, 3).map((rec) => ({
    id: rec.id,
    title: rec.title,
    spec: rec.spec,
    pageCount: rec.pages.length,
    pages: rec.pages.map((p, i) => {
      const decoded = proto.corpusCellsFromHex.call(inst, p.graphic);
      return {
        page: i + 1,
        graphicSha256: sha256(String(p.graphic || '')),
        graphicLength: String(p.graphic || '').length,
        decodedPinCount: decoded ? decoded.reduce((a, b) => a + b, 0) : null,
      };
    }),
  }));
  write('corpus-fixtures.json', { totalRecords: corpus.length, records });
}

// ── 5. buildDtms (multi-page DTMS JSON export) ──────────────────────────────
{
  const mk = (w, h) => {
    const items = [11, 42].map((seed, i) => ({
      label: `fixture · ${i + 1}`,
      data: TW.encodeBits(cellsToBitsPlain(seededCells(w, h, seed), w, h), w, h),
    }));
    return TW.buildDtms('regression-fixture', `${w}x${h}`, items);
  };
  write('dtms-build.json', {
    json60x40: mk(60, 40),
    json96x64: mk(96, 64),
  });
}

// ── 6. grid post-processing fx (thickenBits / denoiseBits) ──────────────────
{
  const w = 60, h = 40;
  const base = seededCells(w, h, 42, 0.2);
  const bits = () => cellsToBitsPlain(base, w, h);
  const hexOf = (b) => TW.encodeBits(b, w, h);
  write('grid-fx.json', {
    seed: 42,
    density: 0.2,
    thickenLevel1: hexOf(TW.thickenBits(bits(), w, h, 1)),
    thickenLevelMinus1: hexOf(TW.thickenBits(bits(), w, h, -1)),
    denoise: hexOf(TW.denoiseBits(bits(), w, h)),
  });
}

// ── 7. Library Asset v1 export (buildLibraryAsset, frozen Date) ─────────────
// KNOWN ISSUE (documented in docs/known-issues.md, NOT fixed in Phase 1):
// deriveGraphicFeatures calls this.banaPrintCheck(), which is not defined
// anywhere in the shipped sources, so buildLibraryAsset currently throws a
// TypeError on main. exportFormat('JSON') catches it and shows "Export
// failed". We capture that *current* behavior exactly — the fixture asserts
// the throw. When the bug is fixed (as a separate, reviewed change), this
// fixture must be consciously regenerated alongside that fix.
{
  const w = 60, h = 40;
  const page1 = seededCells(w, h, 11);
  const page2 = seededCells(w, h, 42);
  const inst = makeInstance(Component, {
    state: { gridW: w, gridH: h, lang: 'ko', brailleLang: 'ko-g1', corpusCtx: null },
    cells: page1,
    pages: [page1, page2],
    pageAudio: { 0: { brl: '⠁⠃⠉' } },
    pageVectors: {},
  });
  let result;
  try {
    result = { throws: false, asset: proto.buildLibraryAsset.call(inst, '회귀 픽스처') };
  } catch (e) {
    result = { throws: true, errorName: e.name, errorMessage: e.message };
  }
  write('library-asset-v1.json', { fixedNow: FIXED_NOW, ...result });
}

// ── 8. cellsToBits / bitsToCells bridge parity ───────────────────────────────
{
  const inst = makeInstance(Component);
  const w = 96, h = 64;
  const cells = seededCells(w, h, 7);
  const bits = proto.cellsToBits.call(inst, cells, w, h);
  const back = proto.bitsToCells.call(inst, bits, w, h);
  write('cells-bits-bridge.json', {
    w, h, seed: 7,
    roundTripIdentical: back.length === cells.length && back.every((v, i) => v === cells[i]),
    hexSha256: sha256(TW.encodeBits(bits, w, h)),
  });
}

// ── 9. repository fingerprints (structure guard, current main) ───────────────
{
  const { readRepoFile, extractXdcSource } = await import('./harness.mjs');
  const html = readRepoFile('index.html');
  const count = (re) => (html.match(re) || []).length;
  write('repo-fingerprints.json', {
    xdcBlockCount: count(/<script type="text\/x-dc"/g),
    xdcSourceSha256: sha256(extractXdcSource(html)),
    supportJsSha256: sha256(readRepoFile('support.js')),
    pinsJsSha256: sha256(readRepoFile('vendor/tw/pins.js')),
    aLangSet: count(/aLangSet/g),
    constImpIdx: count(/const impIdx/g),
    languageToggleButtons: count(/ts-language-switch>button\[aria-pressed/g),
  });
}

console.log('baseline capture complete →', OUT);
