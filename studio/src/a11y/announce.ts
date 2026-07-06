import { A11Y, type BoundaryEdge, type CellState, type Language } from '../i18n/messages';
import type { CursorPos } from './cursor';

/** Map a cell's raised flag to its state word key. */
export function cellStateOf(active: boolean): CellState {
  return active ? 'raised' : 'lowered';
}

/**
 * Cursor position announcement, e.g. "12행 5열, 볼록" / "Row 12, column 5,
 * raised". Cursor coords are 0-based; announcements are 1-based (human rows).
 */
export function formatPosition(lang: Language, pos: CursorPos, active: boolean): string {
  return A11Y[lang].position(pos.y + 1, pos.x + 1, cellStateOf(active));
}

/** Toggle-result announcement using the *new* state after the toggle. */
export function formatToggle(lang: Language, pos: CursorPos, newActive: boolean): string {
  return A11Y[lang].toggled(pos.y + 1, pos.x + 1, cellStateOf(newActive));
}

/** Boundary announcement for a blocked move. */
export function formatBoundary(lang: Language, edge: BoundaryEdge): string {
  return A11Y[lang].boundary(edge);
}
