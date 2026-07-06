import { describe, expect, it } from 'vitest';
import { applyChanges, effectiveChanges, mergeStrokeChanges, type CellChange } from '../commands';
import { createEmptyGrid } from '../../utils/tactileGrid';

describe('effectiveChanges', () => {
  it('drops no-op changes (before === after)', () => {
    const changes: CellChange[] = [
      { x: 0, y: 0, before: false, after: true },
      { x: 1, y: 1, before: true, after: true }, // no-op
      { x: 2, y: 2, before: false, after: false }, // no-op
    ];
    expect(effectiveChanges(changes)).toEqual([{ x: 0, y: 0, before: false, after: true }]);
  });
});

describe('applyChanges', () => {
  it('applies forward (after) and inverse (before) states', () => {
    const cells = createEmptyGrid('60x40');
    const changes: CellChange[] = [
      { x: 3, y: 2, before: false, after: true },
      { x: 5, y: 5, before: false, after: true },
    ];
    const forward = applyChanges(cells, changes, 'forward');
    expect(forward.find((c) => c.x === 3 && c.y === 2)?.active).toBe(true);
    expect(forward.find((c) => c.x === 5 && c.y === 5)?.active).toBe(true);

    const back = applyChanges(forward, changes, 'inverse');
    expect(back.find((c) => c.x === 3 && c.y === 2)?.active).toBe(false);
    expect(back.find((c) => c.x === 5 && c.y === 5)?.active).toBe(false);
  });

  it('returns the same reference when there are no changes', () => {
    const cells = createEmptyGrid('60x40');
    expect(applyChanges(cells, [], 'forward')).toBe(cells);
  });
});

describe('mergeStrokeChanges', () => {
  it('keeps original before, updates after, and appends new cells', () => {
    const existing: CellChange[] = [{ x: 0, y: 0, before: false, after: true }];
    const incoming: CellChange[] = [
      { x: 0, y: 0, before: true, after: false }, // same cell, later state
      { x: 1, y: 0, before: false, after: true }, // new cell
    ];
    const merged = mergeStrokeChanges(existing, incoming);
    expect(merged).toContainEqual({ x: 0, y: 0, before: false, after: false });
    expect(merged).toContainEqual({ x: 1, y: 0, before: false, after: true });
    expect(merged).toHaveLength(2);
  });
});
