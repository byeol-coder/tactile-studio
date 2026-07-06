import type { BoundaryEdge } from '../i18n/messages';

/** Grid dimensions in cells. */
export interface Dims {
  width: number;
  height: number;
}

/** A cell cursor position (0-based). */
export interface CursorPos {
  x: number;
  y: number;
}

/** Cursor movement commands, decoupled from key bindings. */
export type CursorMove =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'up-10'
  | 'down-10'
  | 'left-10'
  | 'right-10'
  | 'row-start'
  | 'row-end'
  | 'grid-start'
  | 'grid-end';

/** Clamp a position into the grid so the cursor never leaves bounds. */
export function clampCursor(pos: CursorPos, dims: Dims): CursorPos {
  const maxX = Math.max(0, dims.width - 1);
  const maxY = Math.max(0, dims.height - 1);
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(0, pos.y), maxY),
  };
}

export interface MoveResult {
  pos: CursorPos;
  /** Set when a directional move was fully blocked by an edge (no movement). */
  boundary: BoundaryEdge | null;
}

/**
 * Apply a movement to the cursor, clamped to the grid. If a single directional
 * move (arrow / shift-arrow) results in no change because the cursor is already
 * at that edge, the corresponding boundary is returned so the UI can announce
 * it instead of re-announcing the same cell.
 */
export function moveCursor(pos: CursorPos, move: CursorMove, dims: Dims): MoveResult {
  const maxX = Math.max(0, dims.width - 1);
  const maxY = Math.max(0, dims.height - 1);
  let { x, y } = pos;

  switch (move) {
    case 'up':
      y -= 1;
      break;
    case 'down':
      y += 1;
      break;
    case 'left':
      x -= 1;
      break;
    case 'right':
      x += 1;
      break;
    case 'up-10':
      y -= 10;
      break;
    case 'down-10':
      y += 10;
      break;
    case 'left-10':
      x -= 10;
      break;
    case 'right-10':
      x += 10;
      break;
    case 'row-start':
      x = 0;
      break;
    case 'row-end':
      x = maxX;
      break;
    case 'grid-start':
      x = 0;
      y = 0;
      break;
    case 'grid-end':
      x = maxX;
      y = maxY;
      break;
  }

  const next = clampCursor({ x, y }, dims);
  let boundary: BoundaryEdge | null = null;
  if (next.x === pos.x && next.y === pos.y) {
    // No movement — report the edge only for directional intents.
    if (move === 'left' || move === 'left-10') boundary = 'firstColumn';
    else if (move === 'right' || move === 'right-10') boundary = 'lastColumn';
    else if (move === 'up' || move === 'up-10') boundary = 'firstRow';
    else if (move === 'down' || move === 'down-10') boundary = 'lastRow';
  }
  return { pos: next, boundary };
}
