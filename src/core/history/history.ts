// src/core/history/history.ts
// Verbatim port of the monolith's undo/redo semantics:
//   snapshot(): push current entry onto undo (cap 60, oldest dropped),
//               clear redo.
//   undo():     push current onto redo, restore undo.pop().
//   redo():     push current onto undo, restore redo.pop().
// Entries bundle cells with the active corpus page index (legacy Issue #4).
// Legacy stacks may contain raw Uint8Array entries; restoration tolerates
// them exactly like the monolith's _restoreHistEntry.

import type { CellGrid, HistoryEntry } from '../types.js';

export const HISTORY_LIMIT = 60;

export type LegacyOrEntry = HistoryEntry | CellGrid;

/** Extract the cell buffer from an entry, tolerating legacy raw-array entries. */
export function entryCells(entry: LegacyOrEntry): CellGrid {
  return (entry as HistoryEntry) && (entry as HistoryEntry).cells
    ? (entry as HistoryEntry).cells
    : (entry as CellGrid);
}

export function makeEntry(cells: CellGrid, corpusIndex: number | null = null): HistoryEntry {
  return { cells: cells.slice(), corpusIndex };
}

export class HistoryStack {
  undoStack: LegacyOrEntry[] = [];
  redoStack: LegacyOrEntry[] = [];

  /** monolith snapshot(): capture BEFORE a mutation */
  snapshot(current: HistoryEntry): void {
    this.undoStack.push(current);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  /** monolith undo(): returns the entry to restore, or null when empty */
  undo(current: HistoryEntry): LegacyOrEntry | null {
    if (!this.undoStack.length) return null;
    this.redoStack.push(current);
    return this.undoStack.pop() as LegacyOrEntry;
  }

  /** monolith redo(): returns the entry to restore, or null when empty */
  redo(current: HistoryEntry): LegacyOrEntry | null {
    if (!this.redoStack.length) return null;
    this.undoStack.push(current);
    return this.redoStack.pop() as LegacyOrEntry;
  }

  /** monolith `undoStack = []; redoStack = []` (page switch, grid change, …) */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
