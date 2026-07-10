// src/core/state/types.ts
//
// Typed state shapes for the framework-agnostic EditorStore (Phase 5). These
// name the tool/selection/cursor concepts that were previously anonymous
// fields on the monolith's `this.state` — no behavior is implied by naming
// them, the store (editor-store.ts) is the verbatim-ported behavior.

/** Canonical tool ids — verbatim list from the monolith's ICONS/toolNames
 *  keys (index.html). Do not add tools here that the monolith doesn't have;
 *  do not rename to "clean up" — labels/i18n and keyboard shortcuts key off
 *  these exact ids. */
export type ToolId =
  | 'cursor' | 'pen' | 'eraser' | 'line' | 'rect' | 'ellipse'
  | 'poly' | 'fill' | 'select' | 'text';

export interface ToolState {
  tool: ToolId;
  strokeSize: number;   // pen thickness (1/2/3 → 1×1/2×2/3×3 brush footprint)
  eraserSize: number;
}

export interface SelectionRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SelectionState {
  selRect: SelectionRect | null;
}

export interface CursorState {
  cx: number;
  cy: number;
}

/** Read-only snapshot handed to React via useSyncExternalStore. Never mutate
 *  fields on a snapshot directly — go through the store's command methods,
 *  which produce a new snapshot and notify subscribers. */
export interface EditorSnapshot {
  gridW: number;
  gridH: number;
  pageIndex: number;
  pageCount: number;
  tool: ToolId;
  strokeSize: number;
  eraserSize: number;
  selRect: SelectionRect | null;
  cursor: CursorState;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  /** bumped on every cell mutation so canvas-only consumers can redraw
   *  without decoding the whole document (mirrors the monolith's `rev`). */
  rev: number;
}
