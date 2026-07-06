import { describe, expect, it } from 'vitest';
import { clampCursor, moveCursor, type Dims } from '../cursor';

const G60: Dims = { width: 60, height: 40 };
const G96: Dims = { width: 96, height: 64 };

describe('clampCursor', () => {
  it('keeps positions inside the grid', () => {
    expect(clampCursor({ x: -5, y: -1 }, G60)).toEqual({ x: 0, y: 0 });
    expect(clampCursor({ x: 999, y: 999 }, G60)).toEqual({ x: 59, y: 39 });
  });
});

describe('moveCursor — arrows', () => {
  it('moves by one cell in each direction', () => {
    expect(moveCursor({ x: 5, y: 5 }, 'right', G60).pos).toEqual({ x: 6, y: 5 });
    expect(moveCursor({ x: 5, y: 5 }, 'left', G60).pos).toEqual({ x: 4, y: 5 });
    expect(moveCursor({ x: 5, y: 5 }, 'up', G60).pos).toEqual({ x: 5, y: 4 });
    expect(moveCursor({ x: 5, y: 5 }, 'down', G60).pos).toEqual({ x: 5, y: 6 });
  });

  it('cannot move outside bounds and reports the edge', () => {
    expect(moveCursor({ x: 0, y: 3 }, 'left', G60)).toEqual({ pos: { x: 0, y: 3 }, boundary: 'firstColumn' });
    expect(moveCursor({ x: 59, y: 3 }, 'right', G60)).toEqual({ pos: { x: 59, y: 3 }, boundary: 'lastColumn' });
    expect(moveCursor({ x: 3, y: 0 }, 'up', G60)).toEqual({ pos: { x: 3, y: 0 }, boundary: 'firstRow' });
    expect(moveCursor({ x: 3, y: 39 }, 'down', G60)).toEqual({ pos: { x: 3, y: 39 }, boundary: 'lastRow' });
  });

  it('shift-arrow moves 10 cells and clamps at edges without boundary', () => {
    expect(moveCursor({ x: 20, y: 20 }, 'right-10', G60).pos).toEqual({ x: 30, y: 20 });
    // Partial move to the edge is still movement → no boundary flag.
    expect(moveCursor({ x: 55, y: 20 }, 'right-10', G60)).toEqual({ pos: { x: 59, y: 20 }, boundary: null });
    // Already at the edge → fully blocked → boundary.
    expect(moveCursor({ x: 59, y: 20 }, 'right-10', G60).boundary).toBe('lastColumn');
  });
});

describe('moveCursor — home/end/grid', () => {
  it('Home/End move to row extremes', () => {
    expect(moveCursor({ x: 30, y: 12 }, 'row-start', G60).pos).toEqual({ x: 0, y: 12 });
    expect(moveCursor({ x: 30, y: 12 }, 'row-end', G60).pos).toEqual({ x: 59, y: 12 });
  });

  it('Ctrl/Cmd Home/End move to grid extremes on both grid sizes', () => {
    expect(moveCursor({ x: 30, y: 12 }, 'grid-start', G60).pos).toEqual({ x: 0, y: 0 });
    expect(moveCursor({ x: 30, y: 12 }, 'grid-end', G60).pos).toEqual({ x: 59, y: 39 });
    expect(moveCursor({ x: 4, y: 4 }, 'grid-end', G96).pos).toEqual({ x: 95, y: 63 });
  });

  it('non-directional moves never set a boundary even when already there', () => {
    expect(moveCursor({ x: 0, y: 0 }, 'grid-start', G60).boundary).toBeNull();
    expect(moveCursor({ x: 0, y: 5 }, 'row-start', G60).boundary).toBeNull();
  });
});
