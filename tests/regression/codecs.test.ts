// Regression tests for codec outputs and shipped data integrity.
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import {
  loadVendorTW, loadCorpus, loadStudioClass, makeInstance,
  seededCells, patternCells, cellsToBitsPlain, readRepoFile, extractXdcSource,
} from '../../tools/harness.mjs';
import corpusFix from '../fixtures/baseline/corpus-fixtures.json';
import dtmsFix from '../fixtures/baseline/dtms-build.json';
import gridFx from '../fixtures/baseline/grid-fx.json';
import libAsset from '../fixtures/baseline/library-asset-v1.json';
import fingerprints from '../fixtures/baseline/repo-fingerprints.json';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

let TW: any;
let Component: any;
let proto: any;

beforeAll(() => {
  TW = loadVendorTW();
  ({ Component } = loadStudioClass({ fixedNow: libAsset.fixedNow, tw: TW }));
  proto = Component.prototype;
});

describe('shipped corpus (window.DTMS_CORPUS)', () => {
  it('record hashes and decoded pin counts are unchanged', () => {
    const corpus = loadCorpus();
    expect(corpus.length).toBe(corpusFix.totalRecords);
    const inst = makeInstance(Component);
    for (const rec of corpusFix.records) {
      const live = corpus.find((r: any) => r.id === rec.id);
      expect(live, rec.id).toBeTruthy();
      expect(live.spec).toBe(rec.spec);
      expect(live.pages.length).toBe(rec.pageCount);
      rec.pages.forEach((p, i) => {
        const hex = String(live.pages[i].graphic || '');
        expect(hex.length).toBe(p.graphicLength);
        expect(sha256(hex)).toBe(p.graphicSha256);
        const decoded = proto.corpusCellsFromHex.call(inst, hex);
        const count = decoded ? decoded.reduce((a: number, b: number) => a + b, 0) : null;
        expect(count).toBe(p.decodedPinCount);
      });
    }
  });
});

describe('buildDtms (multi-page DTMS export JSON)', () => {
  const rebuild = (w: number, h: number) => {
    const items = [11, 42].map((seed, i) => ({
      label: `fixture · ${i + 1}`,
      data: TW.encodeBits(cellsToBitsPlain(seededCells(w, h, seed), w, h), w, h),
    }));
    return TW.buildDtms('regression-fixture', `${w}x${h}`, items);
  };
  it('60×40 output is byte-identical (dotpad320)', () => {
    expect(rebuild(60, 40)).toBe(dtmsFix.json60x40);
    expect(JSON.parse(dtmsFix.json60x40).device).toBe('dotpad320');
  });
  it('96×64 output is byte-identical (dotpad768)', () => {
    expect(rebuild(96, 64)).toBe(dtmsFix.json96x64);
    expect(JSON.parse(dtmsFix.json96x64).device).toBe('dotpad768');
  });
});

describe('grid post-processing fx (thickenBits / denoiseBits)', () => {
  it('outputs are byte-identical to baseline', () => {
    const w = 60, h = 40;
    const base = seededCells(w, h, gridFx.seed, gridFx.density);
    const bits = () => cellsToBitsPlain(base, w, h);
    expect(TW.encodeBits(TW.thickenBits(bits(), w, h, 1), w, h)).toBe(gridFx.thickenLevel1);
    expect(TW.encodeBits(TW.thickenBits(bits(), w, h, -1), w, h)).toBe(gridFx.thickenLevelMinus1);
    expect(TW.encodeBits(TW.denoiseBits(bits(), w, h), w, h)).toBe(gridFx.denoise);
  });
});

describe('buildLibraryAsset — Library Asset v1 export (banaPrintCheck fixed)', () => {
  // banaPrintCheck was missing on earlier mains (buildLibraryAsset threw); it
  // is now implemented, and this fixture was consciously regenerated with
  // that fix (see docs/known-issues.md). Dates are frozen via fixedNow.
  it('produces a byte-identical Library Asset v1 payload', () => {
    const w = 60, h = 40;
    const page1 = seededCells(w, h, 11);
    const inst = makeInstance(Component, {
      state: { gridW: w, gridH: h, lang: 'ko', brailleLang: 'ko-g1', corpusCtx: null },
      cells: page1,
      pages: [page1, seededCells(w, h, 42)],
      pageAudio: { 0: { brl: '⠁⠃⠉' } },
      pageVectors: {},
    });
    expect(libAsset.throws).toBe(false);
    const asset = proto.buildLibraryAsset.call(inst, '회귀 픽스처');
    expect(asset).toEqual((libAsset as any).asset);
    expect(JSON.stringify(asset)).toBe(JSON.stringify((libAsset as any).asset));
  });

  it('banaPrintCheck flags empty / too-dense / isolated-heavy pages', () => {
    const inst = makeInstance(Component);
    const w = 60, h = 40;
    const empty = proto.banaPrintCheck.call(inst, new Uint8Array(w * h), w, h);
    expect(empty.pass).toBe(false);
    expect(empty.key).toBe('tooSparse');
    const dense = proto.banaPrintCheck.call(inst, patternCells(w, h, 'all-on'), w, h);
    expect(dense.pass).toBe(false);
    expect(dense.key).toBe('tooDense');
    const ok = proto.banaPrintCheck.call(inst, seededCells(w, h, 11), w, h);
    expect(ok.pass).toBe(true);
    expect(ok.key).toBe('readable');
  });
});

describe('repository structure fingerprints', () => {
  it('index.html still contains exactly one syntactically valid x-dc block', () => {
    const html = readRepoFile('index.html');
    const count = (re: RegExp) => (html.match(re) || []).length;
    expect(count(/<script type="text\/x-dc"/g)).toBe(fingerprints.xdcBlockCount);
    const src = extractXdcSource(html);
    expect(sha256(src)).toBe(fingerprints.xdcSourceSha256);
    expect(count(/aLangSet/g)).toBe(fingerprints.aLangSet);
    expect(count(/const impIdx/g)).toBe(fingerprints.constImpIdx);
    expect(count(/ts-language-switch>button\[aria-pressed/g)).toBe(fingerprints.languageToggleButtons);
  });
  it('support.js and pins.js are unchanged', () => {
    expect(sha256(readRepoFile('support.js'))).toBe(fingerprints.supportJsSha256);
    expect(sha256(readRepoFile('vendor/tw/pins.js'))).toBe(fingerprints.pinsJsSha256);
  });
});
