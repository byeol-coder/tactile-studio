// src/core/document/document.ts
// The monolith's page operations (addPage / deletePageAt / movePage / setGrid)
// re-expressed as explicit document transitions. Index math, identity
// tracking, undo-clearing rules, and metadata reindexing are ported verbatim;
// parity tests replay the same operation scripts against the shipped
// implementation and compare every buffer, index, and map.
//
// UI concerns deliberately NOT ported here (they stay in the shell until
// Phase 5): announcements (say), live/braille preview scheduling, selection
// and keyboard-cursor state resets, dialog state. The `historyCleared` flag
// tells the caller when the monolith would have wiped undo/redo.

import type { CellGrid, PageMap, StudioDocument } from '../types.js';
import { createGrid, resampleGrid } from '../grid/grid.js';
import { reindexMapInsert, reindexMapDelete, reindexMapMove } from '../page/page-maps.js';

export function createDocument(title: string, w: number, h: number): StudioDocument {
  return {
    title,
    grid: { w, h },
    pages: [createGrid(w, h)],
    pageIndex: 0,
    pageAudio: {},
    pageVectors: {},
  };
}

/** monolith cells === pages[pageIndex] invariant */
export function activeCells(doc: StudioDocument): CellGrid {
  return doc.pages[doc.pageIndex];
}

export interface PageOpResult {
  changed: boolean;
  /** true when the monolith would have cleared the active page's undo/redo */
  historyCleared: boolean;
}

/** monolith addPage(): insert a blank page right after the active one and
 *  activate it. Always clears history. */
export function addPage(doc: StudioDocument): PageOpResult {
  const blank = createGrid(doc.grid.w, doc.grid.h);
  const at = doc.pageIndex + 1;
  doc.pages.splice(at, 0, blank);
  doc.pageAudio = reindexMapInsert(doc.pageAudio, at);
  doc.pageVectors = reindexMapInsert(doc.pageVectors, at) as PageMap<unknown[]>;
  doc.pageIndex = at;
  return { changed: true, historyCleared: true };
}

/** monolith deletePageAt(idx): refuses to delete the last page; active-page
 *  deletion clears history and clamps the index, non-active deletion only
 *  shifts the index when the removed page sat before it. */
export function deletePageAt(doc: StudioDocument, idx: number): PageOpResult {
  if (doc.pages.length <= 1) return { changed: false, historyCleared: false };
  const wasActive = idx === doc.pageIndex;
  doc.pages.splice(idx, 1);
  doc.pageAudio = reindexMapDelete(doc.pageAudio, idx);
  doc.pageVectors = reindexMapDelete(doc.pageVectors, idx) as PageMap<unknown[]>;
  const n = doc.pages.length;
  if (wasActive) {
    doc.pageIndex = Math.max(0, Math.min(n - 1, idx));
    return { changed: true, historyCleared: true };
  }
  doc.pageIndex = idx < doc.pageIndex ? doc.pageIndex - 1 : doc.pageIndex;
  return { changed: true, historyCleared: false };
}

/** monolith movePage(from, to): clamps `to`, tracks the active page by buffer
 *  identity so it stays selected across the move, remaps metadata in
 *  lockstep. Never clears history (same buffer object, only reindexed). */
export function movePage(doc: StudioDocument, from: number, to: number): boolean {
  const n = doc.pages.length;
  if (from < 0 || from >= n) return false;
  to = Math.max(0, Math.min(n - 1, to));
  if (to === from) return false;
  const active = doc.pages[doc.pageIndex];
  const [moved] = doc.pages.splice(from, 1);
  doc.pages.splice(to, 0, moved);
  doc.pageAudio = reindexMapMove(doc.pageAudio, from, to);
  doc.pageVectors = reindexMapMove(doc.pageVectors, from, to) as PageMap<unknown[]>;
  doc.pageIndex = doc.pages.indexOf(active);
  return true;
}

/** monolith setGrid(w, h): nearest-neighbor resample of EVERY page, active
 *  buffer re-aliased, history cleared. No-op when the size is unchanged. */
export function setGrid(doc: StudioDocument, w: number, h: number): PageOpResult {
  if (w === doc.grid.w && h === doc.grid.h) return { changed: false, historyCleared: false };
  const ow = doc.grid.w, oh = doc.grid.h;
  doc.pages = doc.pages.map((old) => resampleGrid(old, ow, oh, w, h));
  doc.grid = { w, h };
  return { changed: true, historyCleared: true };
}
