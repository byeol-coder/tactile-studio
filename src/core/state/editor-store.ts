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

import type { StudioDocument, CellGrid, HistoryEntry, PageMap } from '../types.js';
import { activeCells, addPage as coreAddPage, duplicatePage as coreDuplicatePage, deletePageAt as coreDeletePageAt, movePage as coreMovePage, setGrid as coreSetGrid, goToPage as coreGoToPage } from '../document/document.js';
import { HistoryStack, makeEntry, entryCells } from '../history/history.js';
import { flipHoriz, flipVert, invertAll, clearAll } from '../grid/grid.js';
import { reindexMapInsert } from '../page/page-maps.js';
import { decodeDtms60x40Hex } from '../../codecs/dtms/dtms.js';
import type { ParsedSessionSnapshot } from '../../codecs/document/session-snapshot.js';
import type { ToolId, EditorSnapshot, SelectionRect, BraillePreview, CorpusNavContext } from './types.js';

export interface PageAudioEntry {
  desc?: string;
  narration?: string;
  brl?: string;
  [key: string]: unknown;
}

export type Unsubscribe = () => void;

export interface EditorStoreOptions {
  initialTool?: ToolId;
  initialZoom?: number;
  onChange?(document: StudioDocument): void;
  onDirtyChange?(dirty: boolean): void;
  /** Optional crash-recovery autosave backend (localStorage-backed in
   *  production, see storage/adapters/session-recovery-storage-adapter.ts).
   *  If omitted, the feature simply no-ops -- same "optional, host-provided"
   *  pattern as DotPadPanel's adapter. Typed structurally (see
   *  SessionRecoveryAdapterLike below) rather than importing from storage/,
   *  same reason as BrailleServiceLike: core/ must not depend on storage/. */
  sessionRecovery?: SessionRecoveryAdapterLike;
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
  private brailleLang = 'ko-g2';
  private brailleBusy = false;
  private braillePreview: BraillePreview | null = null;
  private brailleApplyToken = 0; // guards against a stale async response landing after a page switch
  private announceText = '';
  private corpusCtx: CorpusNavContext | null = null;
  private sessionRecovery?: SessionRecoveryAdapterLike;
  private recoverOffer = false;
  private pendingRecoverSnap: ParsedSessionSnapshot | null = null;
  private sessionAutosaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(initialDocument: StudioDocument, opts: EditorStoreOptions = {}) {
    this.doc = initialDocument;
    this.tool = opts.initialTool ?? 'pen';
    this.zoom = opts.initialZoom ?? 1;
    this.opts = opts;
    this.sessionRecovery = opts.sessionRecovery;
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
      brailleLang: this.brailleLang,
      brailleBusy: this.brailleBusy,
      braillePreview: this.braillePreview,
      announce: this.announceText,
      corpusCtx: this.corpusCtx,
      recoverOffer: this.recoverOffer,
    };
  }

  private notify() {
    this.snapshotCache = this.computeSnapshot();
    for (const l of this.listeners) l();
    this.opts.onChange?.(this.doc);
  }

  private setDirty(next: boolean) {
    // Reschedule the crash-recovery debounce on every dirty-marking call,
    // not just the false→true transition -- mirrors the monolith's bump(),
    // which calls _scheduleSession() unconditionally on every edit so the
    // 800ms window keeps resetting while the user keeps typing/drawing.
    if (next) this.scheduleSessionAutosave();
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

  /** monolith duplicatePage(idx): see core/document/document.ts's
   *  duplicatePage() doc comment for the copy semantics. Also resets the
   *  keyboard cursor and selection, matching the monolith's
   *  `setState({ cx:0, cy:0, selRect:null })` alongside the page switch. */
  duplicatePage(idx: number) {
    const r = coreDuplicatePage(this.doc, idx);
    if (!r.changed) return false;
    if (r.historyCleared) this.history.clear();
    this.selRect = null;
    this.cursor = { cx: 0, cy: 0 };
    this.rev++;
    this.setDirty(true);
    this.notify();
    return true;
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

  /** monolith goPage(i): switch the active page (always clears history, a
   *  checkpoint boundary — distinct from movePage, which preserves it). */
  setActivePage(i: number) {
    const r = coreGoToPage(this.doc, i);
    if (!r.changed) return;
    if (r.historyCleared) this.history.clear();
    this.selRect = null;
    this.rev++;
    this.notify();
  }

  /** One-shot pure grid transform (clearAll/invertAll/flipHoriz/flipVert):
   *  snapshot + replace-in-place + bump + notify, atomically. `fn` receives
   *  the CURRENT cells and must return a full replacement buffer (Phase 2
   *  core/grid functions are pure — they don't mutate their input). */
  private applyPureGridOp(fn: (cells: CellGrid, w: number, h: number) => CellGrid) {
    this.snapshotForUndo();
    const { w, h } = this.doc.grid;
    const next = fn(activeCells(this.doc), w, h);
    this.doc.pages[this.doc.pageIndex] = next;
    this.rev++;
    this.setDirty(true);
    this.notify();
  }

  clearAll() { this.applyPureGridOp((cells) => clearAll(cells)); }
  invertAll() { this.applyPureGridOp((cells) => invertAll(cells)); }
  flipHoriz() { this.applyPureGridOp((cells, w, h) => flipHoriz(cells, w, h)); }
  flipVert() { this.applyPureGridOp((cells, w, h) => flipVert(cells, w, h)); }

  /** Grid post-processing (thicken/denoise) — `fn` is injected by the caller
   *  (see codecs/grid-fx), never reimplemented here; this method only wires
   *  it into the same one-shot-mutation transaction shape as the ops above. */
  applyGridFxOp(fn: (cells: CellGrid, w: number, h: number) => CellGrid) {
    this.applyPureGridOp(fn);
  }

  // ── page metadata (desc / narration — autosave text, no braille "Apply"
  //    conversion yet; see docs/known-issues.md) ────────────────────────────

  getPageAudio(i: number = this.doc.pageIndex): PageAudioEntry {
    return (this.doc.pageAudio as PageMap<PageAudioEntry>)[i] || {};
  }

  setPageDesc(text: string) {
    const i = this.doc.pageIndex;
    const cur = this.getPageAudio(i);
    (this.doc.pageAudio as PageMap<PageAudioEntry>)[i] = { ...cur, desc: text };
    this.setDirty(true);
    this.notify();
  }

  setPageNarration(text: string) {
    const i = this.doc.pageIndex;
    const cur = this.getPageAudio(i);
    (this.doc.pageAudio as PageMap<PageAudioEntry>)[i] = { ...cur, narration: text };
    this.setDirty(true);
    this.notify();
  }

  /** monolith importAssetFile's page-replacement step: load a fresh set of
   *  pages as the whole document (clean undo checkpoint — history cleared,
   *  pageAudio/pageVectors reset, active page becomes page 0). Does NOT
   *  resample to a target grid size — the caller's pages must already match
   *  `this.doc.grid`, exactly like the monolith's `if (gridW!==60...)
   *  setGrid(60,40)` guard the import dialog performs before calling in. */
  loadPages(pages: CellGrid[], title?: string) {
    if (!pages.length) return;
    this.doc.pages = pages;
    this.doc.pageAudio = {};
    this.doc.pageVectors = {};
    this.doc.pageIndex = 0;
    if (title != null) this.doc.title = title;
    this.history.clear();
    this.selRect = null;
    this.corpusCtx = null;
    this.rev++;
    this.setDirty(true);
    this.notify();
  }

  /** monolith seedCorpusResult(result, mode): load a corpus search hit onto
   *  the canvas. `mode: 'new'` inserts a fresh page right after the active
   *  one (like addPage, but seeded with the hit's cells instead of blank);
   *  `mode: 'replace'` snapshots and replaces the active page's cells.
   *  Always resizes to 60×40 first if needed (corpus data is 60×40-native).
   *  `ctx`, if the record has more than one page, is stored as corpusCtx so
   *  `corpusGoPage` can browse the record's OTHER pages without touching the
   *  document's own page array (monolith: corpusCtxFor/corpusGoPage). */
  loadCorpusResult(hex: string, mode: 'new' | 'replace', title?: string, ctx: CorpusNavContext | null = null) {
    const cells = decodeDtms60x40Hex(hex);
    if (!cells) return false;
    const gridChanged = this.doc.grid.w !== 60 || this.doc.grid.h !== 40;
    if (gridChanged) this.setGrid(60, 40);
    if (mode === 'new') {
      const at = this.doc.pageIndex + 1;
      this.doc.pages.splice(at, 0, cells);
      this.doc.pageAudio = reindexMapInsert(this.doc.pageAudio, at);
      this.doc.pageVectors = reindexMapInsert(this.doc.pageVectors, at) as PageMap<unknown[]>;
      this.doc.pageIndex = at;
      if (title != null) this.doc.title = title;
      this.history.clear();
      this.selRect = null;
      this.corpusCtx = ctx;
      this.rev++;
      this.setDirty(true);
      this.notify();
    } else {
      this.snapshotForUndo();
      this.doc.pages[this.doc.pageIndex] = cells;
      if (title != null) this.doc.title = title;
      this.selRect = null;
      this.corpusCtx = ctx;
      this.rev++;
      this.setDirty(true);
      this.notify();
    }
    return true;
  }

  /** monolith corpusGoPage(i): browse the active corpus record's OTHER
   *  pages, replacing only the active page's cells (does not touch the
   *  document's page array). Validates range, no-ops on the current index,
   *  decodes the target page's DTMS hex (rejecting anything but a valid
   *  600-hex page exactly like the shipped decoder), snapshots for undo,
   *  and updates corpusCtx.index. Returns false without mutating anything
   *  on any invalid input — never a partial/silent failure. */
  corpusGoPage(i: number): boolean {
    const ctx = this.corpusCtx;
    if (!ctx || !Array.isArray(ctx.pages)) return false;
    if (i < 0 || i >= ctx.pages.length || i === ctx.index) return false;
    const page = ctx.pages[i];
    const hex = page && (page.graphic || page.data);
    const cells = decodeDtms60x40Hex(hex);
    if (!cells) return false;
    this.snapshotForUndo();
    this.doc.pages[this.doc.pageIndex] = cells;
    this.corpusCtx = { id: ctx.id, title: ctx.title, pages: ctx.pages, index: i, query: ctx.query };
    this.selRect = null;
    this.rev++;
    this.setDirty(true);
    this.notify();
    return true;
  }

  /** Host-facing setter, e.g. to clear corpusCtx explicitly without loading
   *  a new result. */
  setCorpusCtx(ctx: CorpusNavContext | null) {
    this.corpusCtx = ctx;
    this.notify();
  }

  /** monolith say(msg): set the live-region announcement text. Core never
   *  owns i18n, so the UI layer calls this with an already-localized string
   *  (from the host's `labels`) after an action — core doesn't generate the
   *  text itself. */
  announce(msg: string) {
    this.announceText = msg;
    this.notify();
  }

  /** Host-facing: clears the dirty flag after a successful save(), without
   *  touching document content or history. */
  markSaved() {
    this.setDirty(false);
    this.notify();
  }

  // ── crash-recovery autosave (verbatim port of the monolith's
  //    _saveSession/_scheduleSession/_loadSession/_applySession/
  //    _dismissRecover, added to vanilla main in ecb67e3 -- AFTER this
  //    branch's fork point, so this is a first-time port here, not a
  //    resync; see docs/known-issues.md #7/#8) ──────────────────────────────

  private scheduleSessionAutosave() {
    if (!this.sessionRecovery) return;
    // Never clobber a snapshot the user hasn't answered the recovery prompt
    // for yet -- exact mirror of the monolith's _saveSession early return.
    if (this.recoverOffer) return;
    if (this.sessionAutosaveTimer) clearTimeout(this.sessionAutosaveTimer);
    this.sessionAutosaveTimer = setTimeout(() => { void this.saveSessionNow(); }, 800);
  }

  private async saveSessionNow(): Promise<void> {
    if (!this.sessionRecovery || this.recoverOffer) return;
    await this.sessionRecovery.save(this.doc, { brailleLang: this.brailleLang });
  }

  /** Host-facing: check for and load any existing crash-recovery snapshot.
   *  Mirrors the monolith's componentDidMount read -- callers MUST invoke
   *  this before the document is first mutated (the monolith reads BEFORE
   *  its own first bump() so the debounced autosave can't clobber the
   *  snapshot with the fresh empty document). Resolves true and sets
   *  `recoverOffer` on the snapshot if a recoverable one was found; false
   *  otherwise (including when no adapter was provided). */
  async checkForRecoverableSession(): Promise<boolean> {
    if (!this.sessionRecovery) return false;
    const snap = await this.sessionRecovery.load();
    if (!snap) return false;
    this.pendingRecoverSnap = snap;
    this.recoverOffer = true;
    this.notify();
    return true;
  }

  /** Host-facing: accept the pending recovery snapshot, replacing the
   *  current document with it wholesale. Mirrors the monolith's
   *  _applySession -- clears history/selection/braille-preview, marks the
   *  store as freshly-restored (not dirty; it now matches the snapshot
   *  exactly), and optionally announces recovery via an already-localized
   *  message (core never owns i18n, same convention as announce()). No-op
   *  if there is no pending snapshot (e.g. already dismissed, or called
   *  without checkForRecoverableSession() finding one first). */
  restoreSession(announceMsg?: string) {
    const snap = this.pendingRecoverSnap;
    if (!snap || !snap.liveCells.length) return;
    let pageIndex = snap.pageIndex;
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= snap.liveCells.length) pageIndex = 0;
    this.doc = {
      title: snap.fileName || '',
      grid: { w: snap.gridW, h: snap.gridH },
      pages: snap.liveCells,
      pageIndex,
      pageAudio: (snap.audio || {}) as PageMap<unknown>,
      pageVectors: (snap.vectors || {}) as PageMap<unknown[]>,
    };
    this.brailleLang = snap.brailleLang || 'ko-g2';
    this.history.clear();
    this.selRect = null;
    this.corpusCtx = null;
    this.brailleBusy = false;
    this.braillePreview = null;
    this.recoverOffer = false;
    this.pendingRecoverSnap = null;
    this.dirty = false; // freshly restored == matches the snapshot, same as the monolith
    if (announceMsg) this.announceText = announceMsg;
    this.rev++;
    this.notify();
  }

  /** Host-facing: dismiss the pending recovery snapshot without applying
   *  it, and remove it from storage so it isn't offered again. Mirrors the
   *  monolith's _dismissRecover. Safe to call with no adapter/no pending
   *  snapshot (no-ops). */
  async dismissRecovery(): Promise<void> {
    this.recoverOffer = false;
    this.pendingRecoverSnap = null;
    this.notify();
    await this.sessionRecovery?.clear();
  }

  /** Cancels any pending debounced autosave. Call on unmount -- mirrors the
   *  monolith's componentWillUnmount's clearTimeout(this._sessT). The store
   *  has no other timers/subscriptions of its own to clean up. */
  dispose() {
    if (this.sessionAutosaveTimer) clearTimeout(this.sessionAutosaveTimer);
    this.sessionAutosaveTimer = null;
  }

  // ── braille "Apply" (verbatim port of the monolith's applyField) ─────────

  setBrailleLang(lang: string) {
    this.brailleLang = lang;
    this.notify();
  }

  /**
   * monolith applyField(field): translate the CURRENT page's desc/narration
   * text to braille via the injected service, store the applied text +
   * timestamp + unicode braille onto that page's audio metadata, and expose
   * the result as `braillePreview` on the snapshot. The monolith always
   * derives the braille SOURCE text as desc-first-then-narration regardless
   * of which field triggered Apply — ported verbatim, not a bug.
   *
   * Guards against a stale response landing after the user has switched
   * pages mid-flight (an incrementing token, same idea as the monolith's
   * `if (this.state.pageIndex !== i) return` checks).
   */
  async applyBraille(field: 'desc' | 'narration', service: BrailleServiceLike): Promise<void> {
    const i = this.doc.pageIndex;
    if (this.brailleBusy) return; // one Apply at a time, like the monolith
    const audio = this.getPageAudio(i);
    const text = field === 'desc' ? (audio.desc || '') : (audio.narration || '');
    if (!text.trim()) return;
    const src = audio.desc || audio.narration || '';
    const token = ++this.brailleApplyToken;
    this.brailleBusy = true;
    this.braillePreview = null;
    this.notify();
    try {
      const r = await service.translate(src, this.brailleLang);
      if (token !== this.brailleApplyToken || this.doc.pageIndex !== i) {
        // page switched or a newer Apply started mid-flight — drop this response
        if (token === this.brailleApplyToken) { this.brailleBusy = false; this.notify(); }
        return;
      }
      if (!r || !r.ok) {
        this.brailleBusy = false;
        this.braillePreview = { ok: false, unicode: '', cells: 0, reason: r?.reason };
        this.notify();
        return;
      }
      const cur = this.getPageAudio(i);
      const stamp = Date.now();
      const patch = field === 'desc'
        ? { descApplied: text, descAt: stamp, brl: r.unicode }
        : { narrApplied: text, narrAt: stamp, brl: r.unicode };
      (this.doc.pageAudio as PageMap<PageAudioEntry>)[i] = { ...cur, ...patch };
      this.brailleBusy = false;
      this.braillePreview = { ok: true, unicode: r.unicode, cells: r.cells };
      this.setDirty(true);
      this.notify();
    } catch (e) {
      if (token !== this.brailleApplyToken) return;
      this.brailleBusy = false;
      this.braillePreview = { ok: false, unicode: '', cells: 0, reason: String((e as Error)?.message || e) };
      this.notify();
    }
  }
}

/** Minimal structural shape EditorStore needs from a braille service — core/
 *  must not import react/types/public-api.ts's BrailleService (core never
 *  depends on the react layer), so this is defined independently. The two
 *  are structurally compatible by design; TypeScript checks that at the
 *  call site (react/hooks or wherever a real BrailleService is passed in). */
export interface BrailleServiceLike {
  translate(text: string, langKey: string): Promise<{ ok: boolean; unicode: string; cells: number; reason?: string }>;
}

/** Minimal structural shape EditorStore needs from a session-recovery
 *  storage backend — core/ must not import storage/adapters/session-
 *  recovery-storage-adapter.ts (core never depends on the storage layer),
 *  so this is defined independently. The real
 *  SessionRecoveryStorageAdapter (storage/) is structurally compatible by
 *  design; TypeScript checks that at the call site (react/ wherever a real
 *  adapter is constructed and passed in as an EditorStoreOptions field). */
export interface SessionRecoveryAdapterLike {
  load(): Promise<ParsedSessionSnapshot | null>;
  save(doc: StudioDocument, extra: { brailleLang: string }): Promise<boolean>;
  clear(): Promise<void>;
}
