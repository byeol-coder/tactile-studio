import type { TactileCell } from '../types/tactile';

/**
 * Command-history model (spec F1.9).
 *
 * Every document edit is expressed as a {@link DocumentCommand}: a compact list
 * of per-cell before/after changes. Forward application uses `after`, inverse
 * (undo) uses `before` — so we never snapshot the whole grid. This is the one
 * canonical editing path; pen, eraser, and future line/shape/fill/select all
 * produce commands of this shape.
 */
export interface CellChange {
  x: number;
  y: number;
  before: boolean;
  after: boolean;
}

export interface DocumentCommand {
  id: string;
  /** Human/i18n-agnostic label, e.g. 'toggle' | 'pen' | 'eraser'. */
  label: string;
  timestamp: string;
  /** Groups a single pointer drag so the whole stroke undoes as one step. */
  strokeId?: string;
  changes: CellChange[];
}

/** Drop changes that don't actually change the cell (no history noise). */
export function effectiveChanges(changes: CellChange[]): CellChange[] {
  return changes.filter((c) => c.before !== c.after);
}

/**
 * Apply a command's changes to a cell list, returning a new list. `direction`
 * selects the target state: forward → `after`, inverse (undo) → `before`.
 */
export function applyChanges(
  cells: TactileCell[],
  changes: CellChange[],
  direction: 'forward' | 'inverse',
): TactileCell[] {
  if (changes.length === 0) return cells;
  const target = new Map<string, boolean>();
  for (const c of changes) {
    target.set(`${c.x},${c.y}`, direction === 'forward' ? c.after : c.before);
  }
  return cells.map((cell) => {
    const next = target.get(`${cell.x},${cell.y}`);
    return next === undefined || next === cell.active ? cell : { ...cell, active: next };
  });
}

/**
 * Merge freshly-painted changes into an existing stroke command (same drag).
 * A cell's `before` is kept from its first touch in the stroke; `after` is
 * updated to the latest value. New cells are appended.
 */
export function mergeStrokeChanges(
  existing: CellChange[],
  incoming: CellChange[],
): CellChange[] {
  const byKey = new Map<string, CellChange>();
  for (const c of existing) byKey.set(`${c.x},${c.y}`, c);
  for (const c of incoming) {
    const key = `${c.x},${c.y}`;
    const prior = byKey.get(key);
    if (prior) byKey.set(key, { ...prior, after: c.after });
    else byKey.set(key, c);
  }
  return [...byKey.values()];
}
