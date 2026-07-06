import { describe, expect, it } from 'vitest';
import { initialState, reducer, type Action, type AppState } from '../appState';
import { createEmptyGrid } from '../../utils/tactileGrid';
import { A11Y } from '../../i18n/messages';
import type { TactileDocument, TactileResolution } from '../../types/tactile';

function stateWithDoc(resolution: TactileResolution = '60x40'): AppState {
  const doc: TactileDocument = {
    id: 'd',
    title: 'History',
    resolution,
    cells: createEmptyGrid(resolution),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  return { ...initialState, document: doc, canvasStatus: 'converted' };
}

function activeAt(s: AppState, x: number, y: number): boolean {
  return Boolean(s.document!.cells.find((c) => c.x === x && c.y === y)?.active);
}

function run(s: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, s);
}

describe('toggle records undoable history', () => {
  it('toggle → undo restores → redo reapplies', () => {
    let s = stateWithDoc();
    s = reducer(s, { type: 'document/toggle-cell', x: 5, y: 12 });
    expect(activeAt(s, 5, 12)).toBe(true);
    expect(s.history.past).toHaveLength(1);

    s = reducer(s, { type: 'history/undo' });
    expect(activeAt(s, 5, 12)).toBe(false);
    expect(s.history.past).toHaveLength(0);
    expect(s.history.future).toHaveLength(1);

    s = reducer(s, { type: 'history/redo' });
    expect(activeAt(s, 5, 12)).toBe(true);
    expect(s.history.future).toHaveLength(0);
  });

  it('a new edit after undo clears the redo stack', () => {
    let s = stateWithDoc();
    s = run(s, { type: 'document/toggle-cell', x: 1, y: 1 }, { type: 'history/undo' });
    expect(s.history.future).toHaveLength(1);
    s = reducer(s, { type: 'document/toggle-cell', x: 2, y: 2 });
    expect(s.history.future).toHaveLength(0);
    expect(s.history.past).toHaveLength(1);
  });

  it('undo after multiple edits reverses them one at a time', () => {
    let s = stateWithDoc();
    s = run(
      s,
      { type: 'document/toggle-cell', x: 0, y: 0 },
      { type: 'document/toggle-cell', x: 1, y: 0 },
      { type: 'document/toggle-cell', x: 2, y: 0 },
    );
    expect(s.history.past).toHaveLength(3);
    s = reducer(s, { type: 'history/undo' });
    expect(activeAt(s, 2, 0)).toBe(false);
    expect(activeAt(s, 1, 0)).toBe(true);
  });
});

describe('pen / eraser via paint-cell', () => {
  it('pen raises, eraser lowers', () => {
    let s = stateWithDoc();
    s = reducer(s, { type: 'document/paint-cell', x: 4, y: 4, value: true });
    expect(activeAt(s, 4, 4)).toBe(true);
    s = reducer(s, { type: 'document/paint-cell', x: 4, y: 4, value: false });
    expect(activeAt(s, 4, 4)).toBe(false);
    expect(s.history.past).toHaveLength(2);
  });

  it('repeated same-state pen/eraser creates no history noise', () => {
    let s = stateWithDoc();
    s = reducer(s, { type: 'document/paint-cell', x: 4, y: 4, value: true });
    const past = s.history.past.length;
    // painting the same value again is a no-op
    s = reducer(s, { type: 'document/paint-cell', x: 4, y: 4, value: true });
    expect(s.history.past).toHaveLength(past);
    // erasing an already-lowered cell is a no-op
    s = reducer(s, { type: 'document/paint-cell', x: 9, y: 9, value: false });
    expect(s.history.past).toHaveLength(past);
  });

  it('groups a drag stroke into one undo step via strokeId', () => {
    let s = stateWithDoc();
    const stroke = 'stroke-1';
    s = run(
      s,
      { type: 'document/paint-cell', x: 0, y: 0, value: true, strokeId: stroke },
      { type: 'document/paint-cell', x: 1, y: 0, value: true, strokeId: stroke },
      { type: 'document/paint-cell', x: 2, y: 0, value: true, strokeId: stroke },
    );
    expect(s.history.past).toHaveLength(1); // one grouped command
    expect(activeAt(s, 0, 0) && activeAt(s, 1, 0) && activeAt(s, 2, 0)).toBe(true);

    s = reducer(s, { type: 'history/undo' });
    expect(activeAt(s, 0, 0) || activeAt(s, 1, 0) || activeAt(s, 2, 0)).toBe(false); // all reverted at once
    expect(s.history.past).toHaveLength(0);
  });
});

describe('select move/copy (F1.8) via set-cells', () => {
  it('applies per-cell values as ONE undoable command', () => {
    let s = stateWithDoc();
    // "move": clear (0,0), set (5,5) raised
    s = reducer(s, {
      type: 'document/set-cells',
      cells: [
        { x: 0, y: 0, value: false },
        { x: 5, y: 5, value: true },
      ],
    });
    expect(activeAt(s, 5, 5)).toBe(true);
    expect(s.history.past).toHaveLength(1); // single command

    s = reducer(s, { type: 'history/undo' });
    expect(activeAt(s, 5, 5)).toBe(false);
    s = reducer(s, { type: 'history/redo' });
    expect(activeAt(s, 5, 5)).toBe(true);
  });

  it('filters no-op cells (setting to current value adds no history)', () => {
    let s = stateWithDoc();
    s = reducer(s, { type: 'document/set-cells', cells: [{ x: 1, y: 1, value: false }] });
    expect(s.history.past).toHaveLength(0); // (1,1) already lowered → no-op
  });

  it('select/copy toggles the mode flag', () => {
    const s = reducer(initialState, { type: 'select/copy', enabled: true });
    expect(s.selectCopy).toBe(true);
  });
});

describe('quick actions (F1.10)', () => {
  function withDots(...coords: [number, number][]) {
    let s = stateWithDoc();
    for (const [x, y] of coords) s = reducer(s, { type: 'document/paint-cell', x, y, value: true });
    return s;
  }

  it('clear-all sets every raised cell to no dot, as one undoable command', () => {
    let s = withDots([1, 1], [2, 2], [3, 3]);
    const commandsBefore = s.history.past.length;
    s = reducer(s, { type: 'document/clear-all' });
    expect(s.document!.quality?.activePins).toBe(0);
    expect(s.history.past).toHaveLength(commandsBefore + 1);

    s = reducer(s, { type: 'history/undo' });
    expect(activeAt(s, 1, 1)).toBe(true); // all three restored in one step
    expect(activeAt(s, 3, 3)).toBe(true);
    s = reducer(s, { type: 'history/redo' });
    expect(s.document!.quality?.activePins).toBe(0);
  });

  it('clear-all on an empty grid is a no-op (no history)', () => {
    const s = stateWithDoc();
    const next = reducer(s, { type: 'document/clear-all' });
    expect(next.history.past).toHaveLength(0);
    expect(next.announcement).toBe(A11Y.ko.quickNothing);
  });

  it('invert flips every cell and is undoable as one command', () => {
    let s = withDots([0, 0]);
    const total = 60 * 40;
    s = reducer(s, { type: 'document/invert' });
    expect(s.document!.quality?.activePins).toBe(total - 1); // (0,0) off, rest on
    expect(activeAt(s, 0, 0)).toBe(false);
    expect(activeAt(s, 5, 5)).toBe(true);
    expect(s.history.past).toHaveLength(2); // paint + invert

    s = reducer(s, { type: 'history/undo' });
    expect(s.document!.quality?.activePins).toBe(1); // back to just (0,0)
    expect(activeAt(s, 0, 0)).toBe(true);
  });

  it('fit-to-grid centers content and is undoable; already-centered is a no-op', () => {
    // one dot at (0,0) → centered on 60×40 → (29 or 30, 19 or 20)
    let s = withDots([0, 0]);
    const before = s.history.past.length;
    s = reducer(s, { type: 'document/fit-grid' });
    expect(activeAt(s, 0, 0)).toBe(false);
    expect(s.document!.quality?.activePins).toBe(1); // still one dot, relocated
    expect(activeAt(s, 29, 19)).toBe(true);
    expect(s.history.past).toHaveLength(before + 1);

    // fitting the now-centered dot again → no-op
    const again = reducer(s, { type: 'document/fit-grid' });
    expect(again.history.past).toHaveLength(before + 1);
    expect(again.announcement).toBe(A11Y.ko.quickNothing);

    s = reducer(s, { type: 'history/undo' });
    expect(activeAt(s, 0, 0)).toBe(true); // move undone as one command
  });

  it('quick actions work on 96x64', () => {
    let s = stateWithDoc('96x64');
    s = reducer(s, { type: 'document/paint-cell', x: 95, y: 63, value: true });
    s = reducer(s, { type: 'document/invert' });
    expect(activeAt(s, 95, 63)).toBe(false);
    expect(activeAt(s, 0, 0)).toBe(true);
  });
});

describe('empty-stack announcements', () => {
  it('announces nothing-to-undo / nothing-to-redo (KO)', () => {
    let s = stateWithDoc();
    s = reducer(s, { type: 'history/undo' });
    expect(s.announcement).toBe(A11Y.ko.nothingToUndo);
    s = reducer(s, { type: 'history/redo' });
    expect(s.announcement).toBe(A11Y.ko.nothingToRedo);
  });

  it('announces the restored/changed cell for single-cell undo/redo (EN)', () => {
    let s: AppState = { ...stateWithDoc(), language: 'en' };
    s = reducer(s, { type: 'document/toggle-cell', x: 4, y: 11 });
    s = reducer(s, { type: 'history/undo' });
    expect(s.announcement).toBe('Undo: row 12, column 5 restored to no dot');
    s = reducer(s, { type: 'history/redo' });
    expect(s.announcement).toBe('Redo: row 12, column 5 changed to dot present');
  });
});

describe('shapes/line (F1.4/F1.5) via paint-cells', () => {
  const hLine = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
  ];

  it('commits a multi-cell set as ONE undoable command', () => {
    let s = stateWithDoc();
    s = reducer(s, { type: 'document/paint-cells', cells: hLine, value: true });
    for (let x = 0; x <= 4; x++) expect(activeAt(s, x, 0)).toBe(true);
    expect(s.history.past).toHaveLength(1); // single command

    s = reducer(s, { type: 'history/undo' });
    for (let x = 0; x <= 4; x++) expect(activeAt(s, x, 0)).toBe(false); // all reverted at once
    expect(s.history.past).toHaveLength(0);

    s = reducer(s, { type: 'history/redo' });
    for (let x = 0; x <= 4; x++) expect(activeAt(s, x, 0)).toBe(true);
  });

  it('erase-shape (value=false) lowers a set of cells as one command', () => {
    let s = stateWithDoc();
    s = reducer(s, { type: 'document/paint-cells', cells: hLine, value: true });
    s = reducer(s, { type: 'document/paint-cells', cells: hLine, value: false });
    for (let x = 0; x <= 4; x++) expect(activeAt(s, x, 0)).toBe(false);
    expect(s.history.past).toHaveLength(2);
  });

  it('creates no history when every cell is already at the target value', () => {
    let s = stateWithDoc();
    s = reducer(s, { type: 'document/paint-cells', cells: hLine, value: true });
    const past = s.history.past.length;
    s = reducer(s, { type: 'document/paint-cells', cells: hLine, value: true }); // all no-ops
    expect(s.history.past).toHaveLength(past);
  });

  it('works on 96x64', () => {
    const diag = Array.from({ length: 6 }, (_, i) => ({ x: i, y: i }));
    let s = stateWithDoc('96x64');
    s = reducer(s, { type: 'document/paint-cells', cells: diag, value: true });
    for (let i = 0; i <= 5; i++) expect(activeAt(s, i, i)).toBe(true);
    s = reducer(s, { type: 'history/undo' });
    for (let i = 0; i <= 5; i++) expect(activeAt(s, i, i)).toBe(false);
  });
});

describe('grids', () => {
  it('history works on 96x64', () => {
    let s = stateWithDoc('96x64');
    s = reducer(s, { type: 'document/paint-cell', x: 95, y: 63, value: true });
    expect(activeAt(s, 95, 63)).toBe(true);
    s = reducer(s, { type: 'history/undo' });
    expect(activeAt(s, 95, 63)).toBe(false);
  });
});
