// src/core/state/editor-store.ts
//
// Framework-agnostic editor store (Phase 5). No React import here — this is
// core/state/, consumed by src/react/ via useSyncExternalStore. Owns:
//   - the StudioDocument (pages, active page, per-page metadata maps)
//   - undo/redo history (Phase 2 HistoryStack, 60-entry cap, verbatim)
//   - tool/selection/cursor/zoom UI state
//
// PERFORMANCE-MOTIVATED ARCHITECTURE CHOICE (not a compatibility change):
// the monolith called `this.bump()` — a real setState — on every single
// pointermove while drawing. The migration spec explicitly requires the
// opposite ("keep high-frequency drawing and pointer state out of broad
// React contexts... do not cause the whole editor to rerender for every pin
// update"), so this store exposes a stroke API instead:
//   beginStroke()  — snapshot() once, at gesture start (undo boundary)
//   paintDuring()  — mutate the active page's cells in place, NO notify
//   endStroke()    — bump rev + dirty, notify once, at gesture end
// The CanvasRenderer (src/ui/canvas) redraws itself on every pointermove via
// its own ref-based loop, independent of this store's subscribers, so the
// rest of the UI (toolbar, inspector, undo/redo buttons) does not re-render
// mid-stroke. The FINAL pixels and the history entry are identical to what a
// single monolith snapshot()+direct-mutation+bump() sequence would produce —
// only the number/timing of React notifications differs.

import type { StudioDocument, CellGrid, HistoryEntry } from '../types.js';
import { activeCells, addPage as coreAddPage, deletePageAt as coreDeletePageAt, movePage as coreMovePage, setGrid as coreSetGrid } from '../document/document.js';
import { HistoryStack, makeEntry, entryCells } from '../history/history.js';
import type { ToolId, EditorSnapshot, SelectionRect } from './types.js';

export type Unsubscribe = () => void;

export interface EditorStoreOptions {
  initialTool?: ToolId;
  initialZoom?: number;
  onChange?(document: StudioDocument): void;
  onDirtyChange?(dirty: boolean): void;
}

export class EditorStore {
  private doc: StudioDocument;
  private history = new HistoryStack();
  private tool: ToolId;
  private strokeSize = 1;
  private eraserSize = 1;
  private selRect: SelectionRect | null = null;
  private cursor = { cx: 0, cy: 0 };
  private zoom: number;
  private rev = 0;
  private dirty = false;
  private listeners = new Set<() => void>();
  private snapshotCache: EditorSnapshot;
  private opts: EditorStoreOptions;

  constructor(initialDocument: StudioDocument, opts: EditorStoreOptions = {}) {
    this.doc = initialDocument;
    this.tool = opts.initialTool ?? 'pen';
    this.zoom = opts.initialZoom ?? 1;
    this.opts = opts;
    this.snapshotCache = this.computeSnapshot();
  }

  // ── subscription (useSyncExternalStore contract) ─────────────────────────

  subscribe = (listener: () => void): Unsubscribe => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = (): EditorSnapshot => this.snapshotCache;

  private computeSnapshot(): EditorSnapshot {
    return {
      gridW: this.doc.grid.w,
      gridH: this.doc.grid.h,
      pageIndex: this.doc.pageIndex,
      pageCount: this.doc.pages.length,
      tool: this.tool,
      strokeSize: this.strokeSize,
      eraserSize: this.eraserSize,
      selRect: this.selRect,
      cursor: { ...this.cursor },
      zoom: this.zoom,
      canUndo: this.history.undoStack.length > 0,
      canRedo: this.history.redoStack.length > 0,
      dirty: this.dirty,
      rev: this.rev,
    };
  }

  private notify() {
    this.snapshotCache = this.computeSnapshot();
    for (const l of this.listeners) l();
    this.opts.onChange?.(this.doc);
  }

  private setDirty(next: boolean) {
    if (this.dirty === next) return;
    this.dirty = next;
    this.opts.onDirtyChange?.(next);
  }

  // ── document access (read-only for consumers) ────────────────────────────

  getDocument(): StudioDocument { return this.doc; }
  getActiveCells(): CellGrid { return activeCells(this.doc); }

  // ── tool / selection / cursor / zoom (low-frequency, always notify) ──────

  setTool(tool: ToolId) { this.tool = tool; this.notify(); }
  setStrokeSize(n: number) { this.strokeSize = Math.max(1, Math.min(3, n | 0)); this.notify(); }
  setEraserSize(n: number) { this.eraserSize = Math.max(1, Math.min(3, n | 0)); this.notify(); }
  setSelRect(rect: SelectionRect | null) { this.selRect = rect; this.notify(); }
  setCursor(cx: number, cy: number) { this.cursor = { cx, cy }; this.notify(); }
  setZoom(z: number) { this.zoom = z; this.notify(); }

  // ── stroke transaction API (see file header) ─────────────────────────────

  /** Snapshot for undo (monolith `snapshot()`); does NOT notify by itself —
   *  callers doing a one-shot mutation should follow with commit(). */
  private snapshotForUndo() {
    this.history.snapshot(makeEntry(activeCells(this.doc), null));
  }

  beginStroke() { this.snapshotForUndo(); }

  /** Mutate the active page's cells in place. No notify — call repeatedly
   *  during a drag; the canvas redraws itself independently. */
  paintDuring(mutator: (cells: CellGrid) => void) {
    mutator(activeCells(this.doc));
  }

  endStroke() {
    this.rev++;
    this.setDirty(true);
    this.notify();
  }

  /** One-shot mutation (fill, clear, invert, flip, shape commit, text stamp):
   *  snapshot + mutate + bump + notify, atomically, like the monolith's
   *  snapshot(); <mutate cells>; bump() sequence for these actions. */
  mutateActiveCells(mutator: (cells: CellGrid) => void) {
    this.snapshotForUndo();
    mutator(activeCells(this.doc));
    this.rev++;
    this.setDirty(true);
    this.notify();
  }

  // ── history ────────────────────────────────────────────────────────────

  undo() {
    const current = makeEntry(activeCells(this.doc), null);
    const entry = this.history.undo(current);
    if (!entry) return false;
    this.applyHistoryEntry(entry);
    return true;
  }

  redo() {
    const current = makeEntry(activeCells(this.doc), null);
    const entry = this.history.redo(current);
    if (!entry) return false;
    this.applyHistoryEntry(entry);
    return true;
  }

  private applyHistoryEntry(entry: HistoryEntry | CellGrid) {
    const cells = entryCells(entry);
    this.doc.pages[this.doc.pageIndex] = cells;
    this.rev++;
    this.setDirty(true);
    this.notify();
  }

  // ── page operations (verbatim Phase 2 core, history-clearing per spec) ──

  addPage() {
    const r = coreAddPage(this.doc);
    if (r.historyCleared) this.history.clear();
    this.rev++;
    this.setDirty(true);
    this.notify();
  }

  deletePageAt(idx: number) {
    const r = coreDeletePageAt(this.doc, idx);
    if (!r.changed) return false;
    if (r.historyCleared) this.history.clear();
    this.rev++;
    this.setDirty(true);
    this.notify();
    return true;
  }

  movePage(from: number, to: number) {
    const changed = coreMovePage(this.doc, from, to);
    if (!changed) return false;
    this.notify(); // buffer identity unchanged; no history clear, matches Phase 2
    return true;
  }

  setGrid(w: number, h: number) {
    const r = coreSetGrid(this.doc, w, h);
    if (!r.changed) return;
    if (r.historyCleared) this.history.clear();
    this.selRect = null;
    this.rev++;
    this.setDirty(true);
    this.notify();
  }

  /** Host-facing: clears the dirty flag after a successful save(), without
   *  touching document content or history. */
  markSaved() {
    this.setDirty(false);
    this.notify();
  }
}
