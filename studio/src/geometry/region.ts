import type { CursorPos, Dims } from '../a11y/cursor';

/** A normalized rectangular region (inclusive, x0≤x1, y0≤y1). */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Build a normalized rect from any two corners. */
export function normRect(a: CursorPos, b: CursorPos): Rect {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y),
  };
}

export function rectWidth(r: Rect): number {
  return r.x1 - r.x0 + 1;
}
export function rectHeight(r: Rect): number {
  return r.y1 - r.y0 + 1;
}

/** Is a cell inside the rect? */
export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/** Shift a rect by an offset. */
export function shiftRect(r: Rect, dx: number, dy: number): Rect {
  return { x0: r.x0 + dx, y0: r.y0 + dy, x1: r.x1 + dx, y1: r.y1 + dy };
}

/**
 * Clamp an offset so `rect + offset` stays fully inside the grid — the safe
 * boundary behavior for moving a selection (no cells fall off / are lost).
 */
export function clampOffset(rect: Rect, offset: { dx: number; dy: number }, dims: Dims): { dx: number; dy: number } {
  let { dx, dy } = offset;
  if (rect.x0 + dx < 0) dx = -rect.x0;
  if (rect.x1 + dx > dims.width - 1) dx = dims.width - 1 - rect.x1;
  if (rect.y0 + dy < 0) dy = -rect.y0;
  if (rect.y1 + dy > dims.height - 1) dy = dims.height - 1 - rect.y1;
  // `|| 0` normalizes a possible -0 (from -rect.x0 when the edge is at 0).
  return { dx: dx || 0, dy: dy || 0 };
}

/**
 * Compute the per-cell final states for moving/copying a region (spec F1.8).
 *
 * - `move` clears the source cells first, then stamps the source pattern at the
 *   destination (overwrite; the stamp wins on overlap).
 * - `copy` leaves the source and only stamps the destination.
 * - Destination cells outside the grid are clipped away safely.
 *
 * Returns `{x,y,value}` targets; the reducer derives before-states for undo.
 */
export function regionMoveCells(
  source: Rect,
  offset: { dx: number; dy: number },
  get: (x: number, y: number) => boolean,
  dims: Dims,
  mode: 'move' | 'copy',
): { x: number; y: number; value: boolean }[] {
  const final = new Map<string, boolean>();

  if (mode === 'move') {
    for (let y = source.y0; y <= source.y1; y++) {
      for (let x = source.x0; x <= source.x1; x++) final.set(`${x},${y}`, false);
    }
  }

  for (let y = source.y0; y <= source.y1; y++) {
    for (let x = source.x0; x <= source.x1; x++) {
      const dx = x + offset.dx;
      const dy = y + offset.dy;
      if (dx < 0 || dy < 0 || dx >= dims.width || dy >= dims.height) continue; // clip
      final.set(`${dx},${dy}`, get(x, y));
    }
  }

  return [...final.entries()].map(([key, value]) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y, value };
  });
}

/**
 * Fit-to-grid (F1.10, minimal safe version): translate the raised content so
 * its bounding box is centered in the grid. Translation only — no scaling
 * (scaling a binary tactile pattern is lossy/ambiguous). Returns per-cell
 * targets (clear old positions, stamp centered ones); empty when there is
 * nothing to move or it is already centered.
 */
export function fitToGridChanges(active: CursorPos[], dims: Dims): { x: number; y: number; value: boolean }[] {
  if (active.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of active) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const targetMinX = Math.max(0, Math.floor((dims.width - w) / 2));
  const targetMinY = Math.max(0, Math.floor((dims.height - h) / 2));
  const dx = targetMinX - minX;
  const dy = targetMinY - minY;
  if (dx === 0 && dy === 0) return []; // already centered

  const final = new Map<string, boolean>();
  for (const c of active) final.set(`${c.x},${c.y}`, false); // clear source
  for (const c of active) {
    const nx = c.x + dx;
    const ny = c.y + dy;
    if (nx < 0 || ny < 0 || nx >= dims.width || ny >= dims.height) continue; // clip (shouldn't happen)
    final.set(`${nx},${ny}`, true); // stamp centered (wins on overlap)
  }
  return [...final.entries()].map(([key, value]) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y, value };
  });
}
