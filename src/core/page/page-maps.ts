// src/core/page/page-maps.ts
// Verbatim ports of the monolith's index-keyed page-metadata reindex helpers
// (_reindexPageAudioInsert/-Delete, _reindexPageVectors…, _reindexPageMapMove).
// pageAudio / pageVectors keep per-page attachments keyed by page index; every
// structural page operation must remap them in lockstep or pages silently
// swap audio/vector data. Names follow the shipped functions.

import type { PageMap } from '../types.js';

/** a page was inserted at `at`: keys ≥ at shift up by one */
export function reindexMapInsert<T>(map: PageMap<T> | undefined, at: number): PageMap<T> {
  const next: PageMap<T> = {};
  Object.keys(map || {}).forEach((k) => {
    const idx = +k;
    next[idx >= at ? idx + 1 : idx] = (map as PageMap<T>)[idx];
  });
  return next;
}

/** the page at `at` was deleted: its key drops, keys > at shift down */
export function reindexMapDelete<T>(map: PageMap<T> | undefined, at: number): PageMap<T> {
  const next: PageMap<T> = {};
  Object.keys(map || {}).forEach((k) => {
    const idx = +k;
    if (idx === at) return;
    next[idx > at ? idx - 1 : idx] = (map as PageMap<T>)[idx];
  });
  return next;
}

/** a page moved from → to (single key deleted at `from`, re-inserted at `to`) */
export function reindexMapMove<T>(map: PageMap<T> | undefined, from: number, to: number): PageMap<T> {
  const next: PageMap<T> = {};
  Object.keys(map || {}).forEach((k) => {
    const idx = +k;
    let ni: number;
    if (idx === from) ni = to;
    else if (from < to && idx > from && idx <= to) ni = idx - 1;
    else if (from > to && idx >= to && idx < from) ni = idx + 1;
    else ni = idx;
    next[ni] = (map as PageMap<T>)[idx];
  });
  return next;
}
