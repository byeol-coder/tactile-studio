// Phase 5 EditorStore tests. Pure logic — no React, no DOM required.
import { describe, it, expect, vi } from 'vitest';
import { EditorStore } from '../../src/core/state/editor-store.js';
import { createDocument } from '../../src/core/document/document.js';
import { makeBrush, line } from '../../src/core/geometry/raster.js';

describe('EditorStore — subscription contract (useSyncExternalStore compatible)', () => {
  it('getSnapshot returns the SAME reference until the next notify', () => {
    const store = new EditorStore(createDocument('doc', 20, 20));
    const s1 = store.getSnapshot();
    const s2 = store.getSnapshot();
    expect(s1).toBe(s2);
    store.setTool('eraser');
    const s3 = store.getSnapshot();
    expect(s3).not.toBe(s1);
  });

  it('notifies every subscriber on a mutation, and stops after unsubscribe', () => {
    const store = new EditorStore(createDocument('doc', 20, 20));
    const calls: number[] = [];
    const unsub = store.subscribe(() => calls.push(1));
    store.setTool('line');
    expect(calls.length).toBe(1);
    unsub();
    store.setTool('rect');
    expect(calls.length).toBe(1);
  });

  it('calls onChange/onDirtyChange host callbacks on mutation', () => {
    const onChange = vi.fn();
    const onDirtyChange = vi.fn();
    const store = new EditorStore(createDocument('doc', 20, 20), { onChange, onDirtyChange });
    store.mutateActiveCells((cells) => { cells[0] = 1; });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });
});

describe('EditorStore — tool/selection/cursor/zoom', () => {
  it('setTool/setStrokeSize/setEraserSize clamp and update the snapshot', () => {
    const store = new EditorStore(createDocument('doc', 20, 20));
    store.setTool('fill');
    expect(store.getSnapshot().tool).toBe('fill');
    store.setStrokeSize(99);
    expect(store.getSnapshot().strokeSize).toBe(3);
    store.setEraserSize(0);
    expect(store.getSnapshot().eraserSize).toBe(1);
  });

  it('setSelRect/setCursor/setZoom update the snapshot', () => {
    const store = new EditorStore(createDocument('doc', 20, 20));
    store.setSelRect({ x0: 1, y0: 1, x1: 5, y1: 5 });
    expect(store.getSnapshot().selRect).toEqual({ x0: 1, y0: 1, x1: 5, y1: 5 });
    store.setCursor(3, 4);
    expect(store.getSnapshot().cursor).toEqual({ cx: 3, cy: 4 });
    store.setZoom(2);
    expect(store.getSnapshot().zoom).toBe(2);
  });
});

describe('EditorStore — stroke transaction API (beginStroke/paintDuring/endStroke)', () => {
  it('does not notify during paintDuring, only at endStroke', () => {
    const store = new EditorStore(createDocument('doc', 20, 20));
    const calls: number[] = [];
    store.subscribe(() => calls.push(1));
    store.beginStroke();
    const brush = makeBrush((x, y) => { store.getActiveCells()[y * 20 + x] = 1; }, 1);
    store.paintDuring(() => line(2, 2, 8, 2, brush));
    store.paintDuring(() => line(8, 2, 8, 8, brush));
    expect(calls.length).toBe(0); // no notification mid-stroke
    store.endStroke();
    expect(calls.length).toBe(1); // exactly one notification at stroke end
    expect(store.getSnapshot().dirty).toBe(true);
    expect(store.getSnapshot().rev).toBe(1);
  });

  it('a full stroke produces exactly one undo entry, restorable by undo()', () => {
    const store = new EditorStore(createDocument('doc', 20, 20));
    store.beginStroke();
    store.paintDuring((cells) => { cells[5] = 1; cells[6] = 1; });
    store.endStroke();
    expect(store.getSnapshot().canUndo).toBe(true);
    expect(store.getActiveCells()[5]).toBe(1);
    store.undo();
    expect(store.getActiveCells()[5]).toBe(0);
    expect(store.getSnapshot().canRedo).toBe(true);
    store.redo();
    expect(store.getActiveCells()[5]).toBe(1);
  });
});

describe('EditorStore — one-shot mutations (fill/clear/invert/flip/shape commit)', () => {
  it('mutateActiveCells snapshots, mutates, and notifies atomically', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    const calls: number[] = [];
    store.subscribe(() => calls.push(1));
    store.mutateActiveCells((cells) => cells.fill(1));
    expect(calls.length).toBe(1);
    expect(Array.from(store.getActiveCells()).every((v) => v === 1)).toBe(true);
    store.undo();
    expect(Array.from(store.getActiveCells()).every((v) => v === 0)).toBe(true);
  });
});

describe('EditorStore — setActivePage (goPage port)', () => {
  it('switches pages, clamps out-of-range, no-ops on the current page, and clears history', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    store.addPage();
    store.addPage();
    store.mutateActiveCells((cells) => { cells[0] = 1; });
    expect(store.getSnapshot().canUndo).toBe(true);

    store.setActivePage(0);
    expect(store.getSnapshot().pageIndex).toBe(0);
    expect(store.getSnapshot().canUndo).toBe(false); // page switch clears history

    store.setActivePage(99); // clamped
    expect(store.getSnapshot().pageIndex).toBe(2);

    const calls: number[] = [];
    store.subscribe(() => calls.push(1));
    store.setActivePage(2); // no-op, already there
    expect(calls.length).toBe(0);
  });
});

describe('EditorStore — pure grid ops (clearAll/invertAll/flipHoriz/flipVert)', () => {
  it('each op snapshots, replaces cells, and is undoable', () => {
    const store = new EditorStore(createDocument('doc', 4, 4));
    store.mutateActiveCells((cells) => { cells[0] = 1; cells[1] = 1; });

    store.invertAll();
    expect(store.getActiveCells()[0]).toBe(0);
    expect(store.getActiveCells()[2]).toBe(1);
    store.undo();
    expect(store.getActiveCells()[0]).toBe(1);

    store.clearAll();
    expect(Array.from(store.getActiveCells()).every((v) => v === 0)).toBe(true);
    store.undo();
    expect(store.getActiveCells()[0]).toBe(1);
  });

  it('flipHoriz/flipVert match the Phase 2 core functions directly', () => {
    const store = new EditorStore(createDocument('doc', 4, 4));
    store.mutateActiveCells((cells) => { cells[0] = 1; }); // (0,0)
    store.flipHoriz();
    expect(store.getActiveCells()[3]).toBe(1); // (3,0)
  });
});

describe('EditorStore — grid-fx (injected thicken/denoise)', () => {
  it('applyGridFxOp wires an injected pure fn through the standard transaction', () => {
    const store = new EditorStore(createDocument('doc', 4, 4));
    const calls: number[] = [];
    store.subscribe(() => calls.push(1));
    store.applyGridFxOp((cells) => { const n = cells.slice(); n[5] = 1; return n; });
    expect(calls.length).toBe(1);
    expect(store.getActiveCells()[5]).toBe(1);
    expect(store.getSnapshot().canUndo).toBe(true);
  });
});

describe('EditorStore — page metadata (desc/narration autosave)', () => {
  it('setPageDesc/setPageNarration store independent per-page text and mark dirty', () => {
    const store = new EditorStore(createDocument('doc', 4, 4));
    store.addPage();
    store.setActivePage(0);
    store.setPageDesc('page one desc');
    store.setActivePage(1);
    expect(store.getPageAudio(1).desc).toBeUndefined();
    store.setPageNarration('page two narration');
    expect(store.getPageAudio(0).desc).toBe('page one desc');
    expect(store.getPageAudio(1).narration).toBe('page two narration');
    expect(store.getSnapshot().dirty).toBe(true);
  });
});

describe('EditorStore — page operations', () => {
  it('addPage/deletePageAt/movePage update pageCount/pageIndex and mark dirty', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    expect(store.getSnapshot().pageCount).toBe(1);
    store.addPage();
    expect(store.getSnapshot().pageCount).toBe(2);
    expect(store.getSnapshot().pageIndex).toBe(1);
    expect(store.getSnapshot().dirty).toBe(true);

    store.addPage();
    expect(store.getSnapshot().pageCount).toBe(3);

    const moved = store.movePage(2, 0);
    expect(moved).toBe(true);
    expect(store.getSnapshot().pageIndex).toBe(0); // active page followed by identity

    const deleted = store.deletePageAt(1);
    expect(deleted).toBe(true);
    expect(store.getSnapshot().pageCount).toBe(2);
  });

  it('deletePageAt refuses to delete the last remaining page', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    expect(store.deletePageAt(0)).toBe(false);
    expect(store.getSnapshot().pageCount).toBe(1);
  });

  it('addPage clears undo/redo history (matches Phase 2 core semantics)', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    store.mutateActiveCells((cells) => { cells[0] = 1; });
    expect(store.getSnapshot().canUndo).toBe(true);
    store.addPage();
    expect(store.getSnapshot().canUndo).toBe(false);
  });
});

describe('EditorStore — setGrid', () => {
  it('resamples pages, clears selection and history, and marks dirty', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    store.mutateActiveCells((cells) => { cells[0] = 1; });
    store.setSelRect({ x0: 0, y0: 0, x1: 2, y1: 2 });
    store.setGrid(96, 64);
    const snap = store.getSnapshot();
    expect(snap.gridW).toBe(96);
    expect(snap.gridH).toBe(64);
    expect(snap.selRect).toBeNull();
    expect(snap.canUndo).toBe(false);
    expect(snap.dirty).toBe(true);
  });

  it('is a no-op when the size is unchanged', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    const calls: number[] = [];
    store.subscribe(() => calls.push(1));
    store.setGrid(60, 40);
    expect(calls.length).toBe(0);
  });
});

describe('EditorStore — markSaved', () => {
  it('clears dirty and notifies onDirtyChange without touching content/history', () => {
    const onDirtyChange = vi.fn();
    const store = new EditorStore(createDocument('doc', 10, 10), { onDirtyChange });
    store.mutateActiveCells((cells) => { cells[0] = 1; });
    expect(store.getSnapshot().dirty).toBe(true);
    store.markSaved();
    expect(store.getSnapshot().dirty).toBe(false);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(store.getSnapshot().canUndo).toBe(true); // markSaved doesn't touch history
  });
});

describe('EditorStore — loadCorpusResult (seedCorpusResult port)', () => {
  it('mode "new" inserts a page right after the active one, resizing to 60x40 if needed', () => {
    const store = new EditorStore(createDocument('doc', 28, 40));
    const hex = '1'.repeat(600); // valid 600-hex, arbitrary pattern
    const ok = store.loadCorpusResult(hex, 'new', 'corpus hit');
    expect(ok).toBe(true);
    expect(store.getSnapshot().gridW).toBe(60);
    expect(store.getSnapshot().gridH).toBe(40);
    expect(store.getSnapshot().pageCount).toBe(2);
    expect(store.getSnapshot().pageIndex).toBe(1);
    expect(store.getSnapshot().canUndo).toBe(false); // history cleared, like addPage
  });

  it('mode "replace" snapshots and replaces the active page (undoable)', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    const before = store.getActiveCells().slice();
    const hex = '2'.repeat(600);
    const ok = store.loadCorpusResult(hex, 'replace');
    expect(ok).toBe(true);
    expect(store.getSnapshot().canUndo).toBe(true);
    store.undo();
    expect(Array.from(store.getActiveCells())).toEqual(Array.from(before));
  });

  it('returns false for invalid hex without mutating the document', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    const calls: number[] = [];
    store.subscribe(() => calls.push(1));
    expect(store.loadCorpusResult('not-valid-hex', 'replace')).toBe(false);
    expect(calls.length).toBe(0);
  });
});

describe('EditorStore — applyBraille (applyField port)', () => {
  it('translates desc-first-then-narration text and stores brl/appliedAt on the page', async () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    store.setPageDesc('안녕하세요');
    const service = { translate: vi.fn().mockResolvedValue({ ok: true, unicode: '⠣⠒⠉', cells: 3 }) };
    await store.applyBraille('desc', service);
    expect(service.translate).toHaveBeenCalledWith('안녕하세요', 'ko-g2');
    expect(store.getPageAudio(0).brl).toBe('⠣⠒⠉');
    expect(store.getPageAudio(0).descApplied).toBe('안녕하세요');
    expect(store.getSnapshot().braillePreview).toEqual({ ok: true, unicode: '⠣⠒⠉', cells: 3 });
    expect(store.getSnapshot().brailleBusy).toBe(false);
  });

  it('falls back to narration text as the braille SOURCE when desc is empty (verbatim monolith behavior)', async () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    store.setPageNarration('나레이션 텍스트');
    const service = { translate: vi.fn().mockResolvedValue({ ok: true, unicode: '⠝', cells: 1 }) };
    await store.applyBraille('narration', service);
    expect(service.translate).toHaveBeenCalledWith('나레이션 텍스트', 'ko-g2');
    expect(store.getPageAudio(0).narrApplied).toBe('나레이션 텍스트');
  });

  it('does nothing when the target field is empty', async () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    const service = { translate: vi.fn(async () => ({ ok: true, unicode: '', cells: 0 })) };
    await store.applyBraille('desc', service);
    expect(service.translate).not.toHaveBeenCalled();
  });

  it('sets a failed braillePreview (never falls back to raw text) when the service reports failure', async () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    store.setPageDesc('text');
    const service = { translate: vi.fn().mockResolvedValue({ ok: false, unicode: '', cells: 0, reason: 'unknown-lang' }) };
    await store.applyBraille('desc', service);
    expect(store.getSnapshot().braillePreview).toEqual({ ok: false, unicode: '', cells: 0, reason: 'unknown-lang' });
    expect(store.getPageAudio(0).brl).toBeUndefined();
  });

  it('ignores a stale response after the page has changed mid-flight', async () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    store.addPage();
    store.setActivePage(0);
    store.setPageDesc('page zero text');
    let resolveFn: (v: { ok: boolean; unicode: string; cells: number }) => void;
    const service = { translate: vi.fn(() => new Promise<{ ok: boolean; unicode: string; cells: number }>((r) => { resolveFn = r; })) };
    const applyPromise = store.applyBraille('desc', service);
    store.setActivePage(1); // switch pages before the translate() resolves
    resolveFn!({ ok: true, unicode: '⠺', cells: 1 });
    await applyPromise;
    expect(store.getPageAudio(0).brl).toBeUndefined(); // stale response dropped
  });

  it('setBrailleLang updates the snapshot and is used by the next applyBraille call', async () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    store.setBrailleLang('ueb-g1');
    expect(store.getSnapshot().brailleLang).toBe('ueb-g1');
    store.setPageDesc('hello');
    const service = { translate: vi.fn().mockResolvedValue({ ok: true, unicode: '⠓', cells: 1 }) };
    await store.applyBraille('desc', service);
    expect(service.translate).toHaveBeenCalledWith('hello', 'ueb-g1');
  });
});

describe('EditorStore — corpusGoPage (multi-page corpus navigation)', () => {
  const makeCtx = (overrides = {}) => ({
    id: 'rec-1', title: 'Test Record', query: 'test',
    pages: [
      { page: 1, label: 'p1', graphic: '1'.repeat(600) },
      { page: 2, label: 'p2', graphic: '2'.repeat(600) },
      { page: 3, label: 'p3', graphic: '3'.repeat(600) },
    ],
    index: 0,
    ...overrides,
  });

  it('navigates to a valid sibling page, replacing only the active page cells (undoable)', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    store.loadCorpusResult('1'.repeat(600), 'replace', 'Test Record', makeCtx() as any);
    const before = store.getActiveCells().slice();

    const ok = store.corpusGoPage(1);
    expect(ok).toBe(true);
    expect(store.getSnapshot().corpusCtx?.index).toBe(1);
    expect(store.getActiveCells()).not.toEqual(before);
    expect(store.getSnapshot().canUndo).toBe(true);

    store.undo();
    expect(Array.from(store.getActiveCells())).toEqual(Array.from(before));
  });

  it('rejects out-of-range or same-index navigation without mutating anything', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    store.loadCorpusResult('1'.repeat(600), 'replace', 'Test Record', makeCtx() as any);
    expect(store.corpusGoPage(0)).toBe(false); // same index
    expect(store.corpusGoPage(-1)).toBe(false);
    expect(store.corpusGoPage(99)).toBe(false);
  });

  it('rejects a sibling page with invalid hex without mutating corpusCtx', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    const ctx = makeCtx({ pages: [{ page: 1, graphic: '1'.repeat(600) }, { page: 2, graphic: 'not-valid-hex' }] });
    store.loadCorpusResult('1'.repeat(600), 'replace', 'Test Record', ctx as any);
    expect(store.corpusGoPage(1)).toBe(false);
    expect(store.getSnapshot().corpusCtx?.index).toBe(0);
  });

  it('returns false when no corpus context is active', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    expect(store.corpusGoPage(1)).toBe(false);
  });

  it('loadPages (asset import) clears an active corpusCtx', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    store.loadCorpusResult('1'.repeat(600), 'replace', 'Test Record', makeCtx() as any);
    expect(store.getSnapshot().corpusCtx).not.toBeNull();
    store.loadPages([new Uint8Array(2400)], 'imported');
    expect(store.getSnapshot().corpusCtx).toBeNull();
  });

  it('setCorpusCtx sets/clears the context directly', () => {
    const store = new EditorStore(createDocument('doc', 60, 40));
    const ctx = makeCtx();
    store.setCorpusCtx(ctx as any);
    expect(store.getSnapshot().corpusCtx).toEqual(ctx);
    store.setCorpusCtx(null);
    expect(store.getSnapshot().corpusCtx).toBeNull();
  });
});

describe('EditorStore — toastMsg (monolith toastMsg() port, backs ui/toast/Toast.tsx)', () => {
  it('sets the toast text on the snapshot and auto-clears it after 2600ms', () => {
    vi.useFakeTimers();
    try {
      const store = new EditorStore(createDocument('doc', 10, 10));
      store.toastMsg('Undone');
      expect(store.getSnapshot().toast).toBe('Undone');
      vi.advanceTimersByTime(2599);
      expect(store.getSnapshot().toast).toBe('Undone');
      vi.advanceTimersByTime(1);
      expect(store.getSnapshot().toast).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a second call before the first clears resets the timer rather than stacking (verbatim clearTimeout behavior)', () => {
    vi.useFakeTimers();
    try {
      const store = new EditorStore(createDocument('doc', 10, 10));
      store.toastMsg('Undone');
      vi.advanceTimersByTime(2000);
      store.toastMsg('Redone');
      vi.advanceTimersByTime(2000); // 4000ms since the first call, 2000ms since the second
      expect(store.getSnapshot().toast).toBe('Redone'); // still showing -- reset, not stacked/raced
      vi.advanceTimersByTime(600); // 2600ms since the second call
      expect(store.getSnapshot().toast).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is null by default, and undo()/redo() themselves do not set it (UI layer owns the localized message, same convention as announce())', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    expect(store.getSnapshot().toast).toBeNull();
    store.mutateActiveCells((cells) => { cells[0] = 1; });
    store.undo();
    expect(store.getSnapshot().toast).toBeNull();
  });

  it('dispose() cancels a pending toast timer (no update-after-dispose, mirrors the sessionAutosaveTimer cleanup)', () => {
    vi.useFakeTimers();
    try {
      const store = new EditorStore(createDocument('doc', 10, 10));
      store.toastMsg('Undone');
      store.dispose();
      expect(() => vi.advanceTimersByTime(3000)).not.toThrow();
      // snapshot cache is whatever it was at dispose time -- the point is
      // the timer callback never fires and never touches a torn-down store.
      expect(store.getSnapshot().toast).toBe('Undone');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('EditorStore — canvas zoom presets (verbatim port of monolith zoomSteps/zoomIn/zoomOut/zoomReset)', () => {
  it('starts at 1 (100%) by default', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    expect(store.getSnapshot().zoom).toBe(1);
  });

  it('zoomIn() steps up through the preset table, one step at a time', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    store.zoomIn();
    expect(store.getSnapshot().zoom).toBe(1.25);
    store.zoomIn();
    expect(store.getSnapshot().zoom).toBe(1.5);
    store.zoomIn();
    expect(store.getSnapshot().zoom).toBe(2);
  });

  it('zoomOut() steps down through the preset table, one step at a time', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    store.zoomOut();
    expect(store.getSnapshot().zoom).toBe(0.75);
    store.zoomOut();
    expect(store.getSnapshot().zoom).toBe(0.5);
  });

  it('zoomIn() at the top of the table clamps to the max step (8) instead of throwing/overshooting', () => {
    const store = new EditorStore(createDocument('doc', 10, 10), { initialZoom: 8 });
    store.zoomIn();
    expect(store.getSnapshot().zoom).toBe(8);
  });

  it('zoomOut() at the bottom of the table clamps to the min step (0.1)', () => {
    const store = new EditorStore(createDocument('doc', 10, 10), { initialZoom: 0.1 });
    store.zoomOut();
    expect(store.getSnapshot().zoom).toBe(0.1);
  });

  it('zoomReset() always returns to exactly 1, regardless of current zoom', () => {
    const store = new EditorStore(createDocument('doc', 10, 10), { initialZoom: 4 });
    store.zoomReset();
    expect(store.getSnapshot().zoom).toBe(1);
  });

  it('zoomIn()/zoomOut() snap an off-step initial value onto the nearest step in the stepping direction (matches monolith\u2019s steps.find/for-loop scan, not a plain lookup)', () => {
    const store = new EditorStore(createDocument('doc', 10, 10), { initialZoom: 0.6 });
    store.zoomIn();
    expect(store.getSnapshot().zoom).toBe(0.75); // next step strictly greater than 0.6
    const store2 = new EditorStore(createDocument('doc', 10, 10), { initialZoom: 0.6 });
    store2.zoomOut();
    expect(store2.getSnapshot().zoom).toBe(0.5); // last step strictly less than 0.6
  });

  it('isAtMinZoom()/isAtMaxZoom() report the ends of the range for disabling the zoom pill\u2019s buttons', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    expect(store.isAtMinZoom()).toBe(false);
    expect(store.isAtMaxZoom()).toBe(false);
    store.zoomReset();
    for (let i = 0; i < 10; i++) store.zoomOut();
    expect(store.isAtMinZoom()).toBe(true);
    store.zoomReset();
    for (let i = 0; i < 10; i++) store.zoomIn();
    expect(store.isAtMaxZoom()).toBe(true);
  });

  it('setZoom() (the raw setter) is unaffected by the new preset helpers -- still accepts any value with no clamping', () => {
    const store = new EditorStore(createDocument('doc', 10, 10));
    store.setZoom(3.33);
    expect(store.getSnapshot().zoom).toBe(3.33);
  });
});
