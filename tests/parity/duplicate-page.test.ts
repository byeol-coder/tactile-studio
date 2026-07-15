// Parity + unit tests for page duplication (core/document/document.ts's
// duplicatePage + EditorStore.duplicatePage), ported from vanilla main's
// `b07c40e` (2026-07-13) -- after this branch's fork point, so this is a
// first-time port (the monolith didn't have page duplication at all when
// Phase 5's initial pass confirmed its absence; see docs/known-issues.md).
import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import { loadVendorTW, loadStudioClass, makeInstance, seededCells, cellsToBitsPlain } from '../../tools/harness.mjs';
import { createDocument, duplicatePage } from '../../src/core/document/document.js';
import { EditorStore } from '../../src/core/state/editor-store.js';
import type { CellGrid } from '../../src/core/types.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

let TW: any;
let Component: any;
let proto: any;
beforeAll(() => {
  TW = loadVendorTW();
  ({ Component } = loadStudioClass({ tw: TW }));
  proto = Component.prototype;
});

const hexOf = (cells: CellGrid, w: number, h: number) => TW.encodeBits(cellsToBitsPlain(cells, w, h), w, h) as string;

describe('duplicatePage core-op parity against the shipped duplicatePage()', () => {
  it('matches page count, active index, buffer contents, and metadata carry-over', () => {
    const w = 60, h = 40;
    const p0 = seededCells(w, h, 3);
    const p1 = seededCells(w, h, 7);

    // --- extracted ---
    const doc = createDocument('doc', w, h);
    doc.pages = [p0.slice(), p1.slice()];
    doc.pageIndex = 0;
    doc.pageAudio = { 0: { desc: 'first page desc' } };
    doc.pageVectors = { 0: [{ type: 'line' }] };
    const r = duplicatePage(doc, 0);

    // --- shipped ---
    const inst = makeInstance(Component, {
      pages: [p0.slice(), p1.slice()],
      pageAudio: { 0: { desc: 'first page desc' } },
      pageVectors: { 0: [{ type: 'line' }] },
      state: { pageIndex: 0 },
    });
    proto.duplicatePage.call(inst, 0);

    expect(r.changed).toBe(true);
    expect(r.historyCleared).toBe(true);
    expect(doc.pageIndex).toBe(inst.state.pageIndex);
    expect(doc.pages.length).toBe(inst.pages.length);
    expect(doc.pages.map((p) => sha256(hexOf(p, w, h)))).toEqual(inst.pages.map((p: CellGrid) => sha256(hexOf(p, w, h))));
    expect(JSON.parse(JSON.stringify(doc.pageAudio))).toEqual(JSON.parse(JSON.stringify(inst.pageAudio)));
    expect(Object.keys(doc.pageVectors)).toEqual(Object.keys(inst.pageVectors));

    // the specific expected shape: 3 pages, new copy at index 1, original
    // page 1 (now at index 2) untouched, metadata carried to index 1 and
    // shifted-away from index 2
    expect(doc.pageIndex).toBe(1);
    expect(doc.pages.length).toBe(3);
    expect(Array.from(doc.pages[1])).toEqual(Array.from(p0));
    expect(Array.from(doc.pages[2])).toEqual(Array.from(p1));
    expect((doc.pageAudio as any)[1]).toEqual({ desc: 'first page desc' });
    expect((doc.pageAudio as any)[0]).toEqual({ desc: 'first page desc' }); // source page keeps its own metadata too
    expect((doc.pageVectors as any)[1]).toEqual([{ type: 'line' }]);
  });

  it('is a no-op (changed:false) for an out-of-range index, matching the shipped guard', () => {
    const doc = createDocument('doc', 60, 40);
    expect(duplicatePage(doc, -1)).toEqual({ changed: false, historyCleared: false });
    expect(duplicatePage(doc, 5)).toEqual({ changed: false, historyCleared: false });
    expect(doc.pages.length).toBe(1);
  });

  it('a shallow metadata reference copy does not cross-bleed on subsequent independent edits', () => {
    // Guards the doc comment's safety claim: EditorStore.setPageDesc always
    // replaces the record via a new object, so editing page 1's desc after
    // duplication must never mutate page 0's (shared at duplication time).
    const store = new EditorStore(createDocument('doc', 60, 40));
    store.setPageDesc('original');
    store.duplicatePage(0); // now on the new page (index 1), sharing page 0's record
    expect(store.getPageAudio(1).desc).toBe('original');
    store.setPageDesc('edited on the copy');
    expect(store.getPageAudio(1).desc).toBe('edited on the copy');
    expect(store.getPageAudio(0).desc).toBe('original'); // untouched
  });
});

describe('EditorStore.duplicatePage', () => {
  it('duplicates the active page, clears history, resets selection/cursor, and marks dirty', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    store.mutateActiveCells((cells) => { cells[0] = 1; });
    store.beginStroke();
    store.paintDuring((cells) => { cells[1] = 1; });
    store.endStroke();
    expect(store.getSnapshot().canUndo).toBe(true);

    const ok = store.duplicatePage(0);
    expect(ok).toBe(true);
    const s = store.getSnapshot();
    expect(s.pageCount).toBe(2);
    expect(s.pageIndex).toBe(1);
    expect(s.canUndo).toBe(false); // history cleared, matches the monolith
    expect(s.dirty).toBe(true);
    expect(s.selRect).toBeNull();
    expect(s.cursor).toEqual({ cx: 0, cy: 0 });
    expect(Array.from(store.getActiveCells())).toEqual(Array.from(store.getDocument().pages[0]));
  });

  it('returns false and does not mutate anything for an out-of-range index', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    const before = store.getDocument();
    expect(store.duplicatePage(9)).toBe(false);
    expect(store.getDocument()).toBe(before);
    expect(store.getSnapshot().pageCount).toBe(1);
  });
});
