import type { TactileResolution } from '../types/tactile';

/**
 * Bundled DTMS corpus (backendless).
 *
 * The task was specified against a Supabase `graphics` table; the studio app has
 * no backend, so the "corpus" is a compact, generated data module (see
 * {@link file://./dtmsCorpus.generated.ts}) produced offline by
 * `scripts/ingest-dtms.mjs`. The record shape mirrors the task's multi-channel
 * `items[]` design so a future viewer can use braille/audio, while Studio's
 * command-load path only reads the graphic layer (`CorpusPage.data`).
 */

/** Corpus classification (aligned to the task's category vocabulary). */
export type CorpusCategory = 'science' | 'language' | 'geography' | 'basic';

/**
 * One page of a corpus graphic — multi-channel, backward-compatible superset of
 * the task's `{ label, data, desc }` item shape. `data` stays the graphic HEX
 * (the sole channel Studio consumes); `braille`/`audio` are preserved when the
 * source has them and are otherwise omitted.
 */
export interface CorpusPage {
  /** 1-based page number from the DTMS item. */
  page: number;
  /** Human label for the page (DTMS `item.title`). */
  label: string;
  /** Graphic layer: DotPad column-major HEX (600 chars for 60×40). */
  data: string;
  /** Human-readable text (`text.plain`), when present. */
  desc?: string;
  /** Braille layer: `text.data` HEX, inlined only when non-empty. */
  braille?: string;
  /** Audio reference (path/filename) metadata only — never a payload. */
  audio?: string;
}

/** A corpus graphic (one ingested DTMS file), all pages preserved. */
export interface CorpusGraphic {
  id: string;
  title: string;
  /** Grid spec — every current sample is 60×40 (`dotpad320`). */
  spec: TactileResolution;
  lang: 'ko' | 'en';
  category: CorpusCategory;
  tags: string[];
  pages: CorpusPage[];
  /** Original DTMS filename (provenance). */
  source?: string;
}
