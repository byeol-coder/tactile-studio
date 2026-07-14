// src/storage/adapters/local-library-storage-adapter.ts
//
// Real localStorage I/O for the monolith's "saved shelf" (key 'ts.library.v1'
// — see the shipped loadLibrary/saveLibrary). This is a DIFFERENT shape from
// StudioStorageAdapter (a list of items, not a single document by id), so it
// gets its own small interface rather than being forced into that one.
//
// Per the migration principle "Tactile Studio must not own cloud storage" —
// local storage gets the identical treatment: the pure encode/decode lives in
// codecs/document/local-library.ts (Phase 3), and ALL localStorage access is
// isolated here, behind an adapter, injectable and mockable (see
// memory-library-storage-adapter.ts for a non-DOM test double).
//
// save() resolves a boolean (true = persisted, false = didn't) rather than
// void — see docs/known-issues.md #7. The original shipped saveLibrary()
// swallowed storage failures with no return value at all; this was faithfully
// ported verbatim during Phase 4, then fixed in an isolated commit (matching
// this repo's own migration discipline for #1 banaPrintCheck).

import { toSavedRecords, fromSavedRecords, type SavedLibraryItem } from '../../codecs/document/local-library.js';
import type { TwEncodeBits } from '../../codecs/dtms/dtms.js';

export const LOCAL_LIBRARY_KEY = 'ts.library.v1';

export interface LocalLibraryStorageAdapter {
  list(): Promise<SavedLibraryItem[]>;
  /** Resolves true if the write actually persisted, false otherwise (quota
   *  exceeded, private-mode storage block, or no window/localStorage at all).
   *  Previously resolved void unconditionally — callers had no way to detect
   *  a silent failure. See docs/known-issues.md #7. */
  save(items: SavedLibraryItem[]): Promise<boolean>;
}

/**
 * Real browser localStorage-backed adapter. `encodeBits` is injected (the
 * real vendor TW.encodeBits in production) so this module never imports or
 * reimplements the DTMS packing algorithm itself.
 */
export function createLocalLibraryStorageAdapter(encodeBits: TwEncodeBits): LocalLibraryStorageAdapter {
  return {
    async list() {
      if (typeof window === 'undefined' || !window.localStorage) return [];
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(LOCAL_LIBRARY_KEY);
      } catch {
        return []; // storage unavailable (private browsing, quota, …) — same tolerance as production
      }
      if (!raw) return [];
      return fromSavedRecords(raw);
    },

    async save(items: SavedLibraryItem[]) {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      try {
        const records = toSavedRecords(items, encodeBits);
        window.localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(records));
        return true;
      } catch {
        // storage full or unavailable — non-fatal, but now reported to the
        // caller instead of swallowed (matches the shipped saveLibrary fix)
        return false;
      }
    },
  };
}
