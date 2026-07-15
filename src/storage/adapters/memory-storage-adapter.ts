// src/storage/adapters/memory-storage-adapter.ts
//
// An in-memory StudioStorageAdapter — no localStorage, no network, no
// Supabase. Used by the dev shell and by tests that need a real (not
// stubbed) implementation of the interface to exercise load/save error
// paths and round-tripping.

import type { StudioDocument } from '../../core/types.js';
import type { StudioStorageAdapter, SaveResult } from './types.js';

export interface MemoryStorageAdapter extends StudioStorageAdapter {
  /** test/dev-shell hook: seed a document without going through save(). */
  seed(id: string, document: StudioDocument): void;
  has(id: string): boolean;
  clear(): void;
}

export function createMemoryStorageAdapter(): MemoryStorageAdapter {
  const store = new Map<string, StudioDocument>();

  return {
    async load(id: string): Promise<StudioDocument> {
      const doc = store.get(id);
      if (!doc) throw new Error(`No document found for id "${id}"`);
      // return a defensive copy so callers can't mutate the store by reference
      return {
        ...doc,
        grid: { ...doc.grid },
        pages: doc.pages.map((p) => p.slice()),
        pageAudio: { ...doc.pageAudio },
        pageVectors: { ...doc.pageVectors },
      };
    },

    async save(document: StudioDocument): Promise<SaveResult> {
      const id = document.title || `doc-${store.size + 1}`;
      store.set(id, document);
      return { ok: true, id };
    },

    seed(id: string, document: StudioDocument) {
      store.set(id, document);
    },

    has(id: string) {
      return store.has(id);
    },

    clear() {
      store.clear();
    },
  };
}
