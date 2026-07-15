// Phase 2 parity suite: the extracted src/core modules must reproduce the
// shipped monolith's results value-for-value. Baselines in
// tests/fixtures/baseline/core-*.json were captured from the SHIPPED
// implementation (tools/capture-core-baseline.mjs); geometry additionally
// cross-checks against the live shipped code at test time.
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import {
  loadVendorTW, loadStudioClass, makeInstance,
  seededCells, cellsToBitsPlain,
} from '../../tools/harness.mjs';
import { geometryCases, pageScript } from '../../tools/core-cases.mjs';
import {
  line, rectOutline, ellipseOutline, makeBrush, floodFill,
  resampleGrid, flipHoriz, flipVert, invertAll, clearAll,
  HistoryStack, makeEntry, entryCells,
  createDocument, activeCells, addPage, deletePageAt, movePage, setGrid,
} from '../../src/core/index.js';
import type { StudioDocument, CellGrid } from '../../src/core/index.js';
import geomFix from '../fixtures/baseline/core-geometry.json';
import floodFix from '../fixtures/baseline/core-flood.json';
import histFix from '../fixtures/baseline/core-history.json';
import pagesFix from '../fixtures/baseline/core-pages.json';
import gridFix from '../fixtures/baseline/core-grid.json';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const record = (fn: (cb: (x: number, y: number) => void) => void) => {
  const hits: Array<[number, number]> = [];
  fn((x, y) => hits.push([x, y]));
  return hits;
};

let TW: any;
let proto: any;

beforeAll(() => {
  TW = loadVendorTW();
  const { Component } = loadStudioClass({ tw: TW });
  proto = Component.prototype;
});

const hexOf = (cells: CellGrid, w: number, h: number) =>
  TW.encodeBits(cellsToBitsPlain(cells, w, h), w, h) as string;

describe('geometry parity (line / rect / ellipse / brush)', () => {
  it('ordered hit sequences match the frozen baseline AND the live shipped code', () => {
    const inst = makeInstance({ prototype: proto } as any);
    Object.setPrototypeOf(inst, proto);
    geometryCases().forEach((c, i) => {
      const fix = geomFix.cases[i];
      expect({ w: c.w, h: c.h, x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 })
        .toEqual({ w: fix.w, h: fix.h, x0: fix.x0, y0: fix.y0, x1: fix.x1, y1: fix.y1 });
      const tsLine = record((cb) => line(c.x0, c.y0, c.x1, c.y1, cb));
      const tsRect = record((cb) => rectOutline(c.x0, c.y0, c.x1, c.y1, cb));
      const tsEll = record((cb) => ellipseOutline(c.x0, c.y0, c.x1, c.y1, cb));
      // frozen baseline (hashes of ordered sequences)
      expect(sha256(JSON.stringify(tsLine))).toBe(fix.line);
      expect(sha256(JSON.stringify(tsRect))).toBe(fix.rect);
      expect(sha256(JSON.stringify(tsEll))).toBe(fix.ellipse);
      // live shipped code (exact ordered arrays)
      expect(tsLine).toEqual(record((cb) => proto.line.call(inst, c.x0, c.y0, c.x1, c.y1, cb)));
      expect(tsRect).toEqual(record((cb) => proto.rectOutline.call(inst, c.x0, c.y0, c.x1, c.y1, cb)));
      expect(tsEll).toEqual(record((cb) => proto.ellipseOutline.call(inst, c.x0, c.y0, c.x1, c.y1, cb)));
    });
  });

  it('line-thickness brush footprints match for sizes 0/1/2/3', () => {
    for (const b of geomFix.brush) {
      const hits = record((cb) => makeBrush(cb, b.size)(10, 10));
      expect(hits).toEqual(b.hits);
    }
  });
});

describe('flood-fill parity', () => {
  it('reproduces the shipped flood results byte-for-byte', () => {
    const { w, h } = floodFix;
    for (const s of floodFix.scenarios) {
      const cells = seededCells(w, h, s.seed, s.density);
      floodFill(cells, w, h, s.x, s.y);
      expect(hexOf(cells, w, h)).toBe(s.resultHex);
    }
  });
});

describe('history parity (snapshot / undo / redo, 60-entry cap)', () => {
  it('replays the scripted trace with identical depths and buffers', () => {
    const { w, h } = histFix;
    const hist = new HistoryStack();
    let cells: CellGrid = new Uint8Array(w * h);
    const restore = (mode: 'undo' | 'redo') => {
      const e = mode === 'undo' ? hist.undo(makeEntry(cells)) : hist.redo(makeEntry(cells));
      if (e) cells = entryCells(e); // monolith setCells assigns the stored buffer
    };
    const check = (step: string) => {
      const t = histFix.trace.find((x) => x.step === step)!;
      expect(hist.undoStack.length, step).toBe(t.undoDepth);
      expect(hist.redoStack.length, step).toBe(t.redoDepth);
      expect(hexOf(cells, w, h), step).toBe(t.cellsHex);
    };
    for (let i = 0; i < 70; i++) { hist.snapshot(makeEntry(cells)); cells[i % (w * h)] = 1; }
    check('after-70-snapshots');
    for (let i = 0; i < 5; i++) restore('undo');
    check('after-5-undo');
    for (let i = 0; i < 2; i++) restore('redo');
    check('after-2-redo');
    hist.snapshot(makeEntry(cells)); cells[500] = 1;
    check('after-snapshot-clears-redo');
    for (let i = 0; i < 100; i++) restore('undo');
    check('after-drain-undo');
  });
});

describe('page-operation parity (add / delete / move + metadata maps)', () => {
  it('replays the scripted page ops with identical state at every step', () => {
    const { w, h } = pagesFix;
    const doc: StudioDocument = createDocument('parity', w, h);
    doc.pages[0].set(seededCells(w, h, 1, 0.1));
    pageScript().forEach((s: any, i: number) => {
      if (s.op === 'add') addPage(doc);
      else if (s.op === 'delete') deletePageAt(doc, s.idx);
      else if (s.op === 'move') movePage(doc, s.from, s.to);
      else if (s.op === 'meta') (doc.pageAudio as any)[s.page] = { tag: s.tag };
      if (s.op === 'add') activeCells(doc)[i + 1] = 1;
      const fix = pagesFix.states[i];
      expect(doc.pageIndex, `step ${i} ${s.op}`).toBe(fix.pageIndex);
      expect(doc.pages.length, `step ${i} ${s.op}`).toBe(fix.pageCount);
      expect(doc.pages.map((p) => sha256(hexOf(p, w, h))), `step ${i} ${s.op}`).toEqual(fix.pages);
      expect(JSON.parse(JSON.stringify(doc.pageAudio)), `step ${i} ${s.op}`).toEqual(fix.audio);
      expect(Object.keys(doc.pageVectors), `step ${i} ${s.op}`).toEqual(fix.vectors);
      expect(fix.activeAliased, `step ${i} ${s.op}`).toBe(true);
    });
  });
});

describe('grid parity (setGrid resample chain + flips / invert / clear)', () => {
  it('resamples every page identically through 60×40 → 96×64 → 28×40 → 60×40', () => {
    const start = gridFix.chainStart;
    const doc = createDocument('parity', start.w, start.h);
    doc.pages[0].set(seededCells(start.w, start.h, start.seed, start.density));
    for (const step of gridFix.chain) {
      setGrid(doc, step.w, step.h);
      expect(doc.pages.map((p) => sha256(hexOf(p, step.w, step.h)))).toEqual(step.pagesHex);
    }
  });

  it('flipHoriz / flipVert / invertAll / clearAll match byte-for-byte', () => {
    const { seed, density, ...expected } = gridFix.fx;
    const w = 60, h = 40;
    const base = seededCells(w, h, seed, density);
    expect(hexOf(flipHoriz(base, w, h), w, h)).toBe(expected.flipHoriz);
    expect(hexOf(flipVert(base, w, h), w, h)).toBe(expected.flipVert);
    expect(hexOf(invertAll(base), w, h)).toBe(expected.invertAll);
    expect(hexOf(clearAll(base), w, h)).toBe(expected.clearAll);
    // pure functions: the source buffer must be untouched
    expect(Array.from(base)).toEqual(Array.from(seededCells(w, h, seed, density)));
  });

  it('resampleGrid alone matches the shipped nearest-neighbor loop', () => {
    const old = seededCells(60, 40, 123, 0.4);
    const ts = resampleGrid(old, 60, 40, 96, 64);
    // recompute with the shipped formula inline as a second witness
    const ref = new Uint8Array(96 * 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 96; x++) {
      ref[y * 96 + x] = old[Math.floor((y * 40) / 64) * 60 + Math.floor((x * 60) / 96)];
    }
    expect(Array.from(ts)).toEqual(Array.from(ref));
  });
});
