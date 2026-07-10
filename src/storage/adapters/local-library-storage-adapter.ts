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

import { toSavedRecords, fromSavedRecords, type SavedLibraryItem } from '../../codecs/document/local-library.js';
import type { TwEncodeBits } from '../../codecs/dtms/dtms.js';

export const LOCAL_LIBRARY_KEY = 'ts.library.v1';

export interface LocalLibraryStorageAdapter {
  list(): Promise<SavedLibraryItem[]>;
  save(items: SavedLibraryItem[]): Promise<void>;
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
      if (typeof window === 'undefined' || !window.localStorage) return;
      try {
        const records = toSavedRecords(items, encodeBits);
        window.localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(records));
      } catch {
        // storage full or unavailable — session-only, non-fatal (matches
        // the shipped saveLibrary's try/catch-and-ignore behavior exactly)
      }
    },
  };
}
