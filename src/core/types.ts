// src/core/types.ts
// Phase 2 core types. These model the EXISTING runtime data verbatim — do not
// "improve" shapes here without a compatibility review; serialized documents,
// Library Asset v1 payloads, and undo entries all depend on them.

/** A single pin cell: 0 = down, 1 = up. Stored in a Uint8Array. */
export type CellValue = 0 | 1;

/** Flat row-major pin buffer of length w*h (matches the legacy `cells`). */
export type CellGrid = Uint8Array;

export interface GridSize {
  w: number;
  h: number;
}

/**
 * Undo/redo history entry — bundles the cell buffer with the corpus page
 * index at capture time (legacy Issue #4) so undo/redo can restore the
 * navigator label in sync with the canvas. `corpusIndex` is null when no
 * multi-page corpus is active. Legacy stacks may contain raw CellGrid
 * entries; restore paths must tolerate that (see history.ts).
 */
export interface HistoryEntry {
  cells: CellGrid;
  corpusIndex: number | null;
}

/** Index-keyed per-page metadata map (audio, vector objects, …). Keys are
 *  page indices; the legacy runtime stores them as plain objects. */
export type PageMap<T> = Record<number, T>;

/** One page of a document. The legacy runtime keeps pages as bare CellGrid
 *  buffers tracked by identity; per-page metadata lives in separate
 *  index-keyed maps. StudioPage groups them for the new API surface. */
export interface StudioPage {
  cells: CellGrid;
  /** braille description / narration / attached audio (legacy pageAudio[i]) */
  audio?: unknown;
  /** optional vectorLineObjects (legacy pageVectors[i], additive-only field) */
  vectors?: unknown[];
}

/**
 * The document model mirroring the legacy runtime state relevant to pages:
 * `pages` are bare buffers (identity-tracked, exactly like the monolith),
 * `pageAudio`/`pageVectors` are the index-keyed metadata maps, and
 * `pageIndex` is the active page. `cells` in the monolith is always an alias
 * of `pages[pageIndex]`; the extracted ops maintain that invariant.
 */
export interface StudioDocument {
  title: string;
  grid: GridSize;
  pages: CellGrid[];
  pageIndex: number;
  pageAudio: PageMap<unknown>;
  pageVectors: PageMap<unknown[]>;
}
