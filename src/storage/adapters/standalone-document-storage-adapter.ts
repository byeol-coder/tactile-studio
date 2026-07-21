// src/storage/adapters/standalone-document-storage-adapter.ts
//
// Real localStorage-backed StudioStorageAdapter for the standalone build
// (src/app/standalone). Unlike local-library-storage-adapter.ts (a flat,
// single-page "shelf preview" shape — see its own doc comment), this must
// round-trip a FULL StudioDocument (multi-page, pageAudio, pageVectors), so
// it reuses the same pack/unpack + serialize primitives that
// session-recovery-storage-adapter.ts already established for exactly that
// shape (codecs/document/session-snapshot.ts), rather than inventing a new
// on-disk format.
//
// Deliberately NOT the same storage key as session recovery ('ts.session.v1')
// — that key is crash-recovery-only and is gated by "is this worth offering
// to restore" (hasRecoverableContent). This is the standalone app's actual
// Save/Load target: it must persist and reload even a deliberately-saved
// blank document, so it skips that gate entirely.
//
// Single-slot for now (the `id` passed to load() is accepted but ignored —
// the standalone build has no document catalog/Hub yet, see the entry-point
// scoping notes). Revisit if/when a multi-document catalog is added.

import {
  packCells, unpackCells, serializeSessionSnapshot, type SessionSnapshotV1,
} from '../../codecs/document/session-snapshot.js';
import { createDocument } from '../../core/document/document.js';
import { createGrid } from '../../core/grid/grid.js';
import type { StudioDocument } from '../../core/types.js';
import type { StudioStorageAdapter, SaveResult, SaveOptions } from './types.js';

export const STANDALONE_DOCUMENT_KEY = 'ts.standalone-doc.v1';

// Matches ExportMenu.tsx's own default (see its buildDtms call) — brailleLang
// isn't part of StudioDocument itself (it lives on the EditorStore snapshot,
// see Inspector.tsx's store.setBrailleLang), so a live value isn't reachable
// from here. Fixed default until the standalone app grows its own braille
// language wiring.
const DEFAULT_BRAILLE_LANG = 'ko-g2';

function blankDocument(): StudioDocument {
  return createDocument('', 60, 40);
}

function snapshotToDocument(snap: SessionSnapshotV1): StudioDocument {
  const len = snap.gridW * snap.gridH;
  const pages = snap.pages.map((b64) => unpackCells(b64, len));
  return {
    title: snap.fileName || '',
    grid: { w: snap.gridW, h: snap.gridH },
    pages: pages.length ? pages : [createGrid(snap.gridW, snap.gridH)],
    pageIndex: Math.min(Math.max(snap.pageIndex || 0, 0), Math.max(pages.length - 1, 0)),
    pageAudio: snap.audio || {},
    pageVectors: snap.vectors || {},
  };
}

/** Existence check, separate from load() — load() always resolves a usable
 *  StudioDocument (falling back to blank on any error/absence), so it can't
 *  by itself distinguish "nothing saved yet" from "a legitimately blank
 *  document was saved". The host (StandaloneApp) needs that distinction to
 *  decide whether to show the size picker or just load straight in. */
export function hasSavedStandaloneDocument(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(STANDALONE_DOCUMENT_KEY) != null;
  } catch {
    return false;
  }
}

/** Real browser localStorage-backed adapter. `id` is currently a no-op —
 *  single document slot, matching the standalone entry point's scope
 *  (no Hub/catalog yet). */
export function createStandaloneDocumentStorageAdapter(): StudioStorageAdapter {
  return {
    async load(_id: string): Promise<StudioDocument> {
      if (typeof window === 'undefined' || !window.localStorage) return blankDocument();
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(STANDALONE_DOCUMENT_KEY);
      } catch {
        return blankDocument(); // storage unavailable (private browsing, quota, …)
      }
      if (!raw) return blankDocument();
      try {
        const snap = JSON.parse(raw) as SessionSnapshotV1;
        if (!snap || !Array.isArray(snap.pages) || !snap.pages.length) return blankDocument();
        return snapshotToDocument(snap);
      } catch {
        return blankDocument();
      }
    },

    async save(document: StudioDocument, _options?: SaveOptions): Promise<SaveResult> {
      if (typeof window === 'undefined' || !window.localStorage) {
        return { ok: false, error: 'localStorage unavailable' };
      }
      try {
        const snapshot = serializeSessionSnapshot(document, { brailleLang: DEFAULT_BRAILLE_LANG });
        window.localStorage.setItem(STANDALONE_DOCUMENT_KEY, JSON.stringify(snapshot));
        return { ok: true, id: 'standalone' };
      } catch (e) {
        // quota exceeded / private-mode storage block — reported, not swallowed
        // (same discipline as local-library-storage-adapter.ts's save()).
        return { ok: false, error: e instanceof Error ? e.message : 'save failed' };
      }
    },
  };
}

// Re-exported for tests that only need the pure pack helper.
export { packCells };
