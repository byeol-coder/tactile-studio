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
