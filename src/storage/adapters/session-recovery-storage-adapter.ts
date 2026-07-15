// src/storage/adapters/session-recovery-storage-adapter.ts
//
// Real localStorage I/O for the monolith's crash-recovery autosave (key
// 'ts.session.v1' -- see codecs/document/session-snapshot.ts's doc comment
// for why this is a first-time port, not a resync). Same split as
// local-library-storage-adapter.ts: pure encode/decode lives in the codec,
// ALL localStorage access is isolated here, behind an adapter, injectable
// and mockable.
//
// save()/clear() resolve booleans (true = succeeded) rather than swallowing
// failures -- see the codec file's doc comment for why this feature gets
// the already-known-correct contract from day one instead of re-shipping
// the local-library adapter's original silent-failure bug.

import {
  packCells, parseSessionSnapshot, serializeSessionSnapshot, hasRecoverableContent,
  type ParsedSessionSnapshot, type SessionSnapshotV1,
} from '../../codecs/document/session-snapshot.js';
import type { StudioDocument } from '../../core/types.js';

export const SESSION_RECOVERY_KEY = 'ts.session.v1';

export interface SessionRecoveryStorageAdapter {
  /** Loads and validates any existing snapshot. Resolves null if there is
   *  none, it's malformed, or it isn't "worth" offering for recovery. */
  load(): Promise<ParsedSessionSnapshot | null>;
  /** Serializes and persists the current document. Resolves true if it
   *  actually persisted, false otherwise (quota/private-mode/no window) --
   *  and true without writing anything if the document has no recoverable
   *  content (matches the monolith: an empty/trivial doc clears any
   *  existing snapshot instead of writing one). */
  save(doc: StudioDocument, extra: { brailleLang: string }): Promise<boolean>;
  /** Removes any stored snapshot (monolith's _dismissRecover /
   *  post-successful-save cleanup). Never throws. */
  clear(): Promise<void>;
}

export function createSessionRecoveryStorageAdapter(): SessionRecoveryStorageAdapter {
  return {
    async load() {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(SESSION_RECOVERY_KEY);
      } catch {
        return null; // storage unavailable (private browsing, quota, …)
      }
      if (!raw) return null;
      return parseSessionSnapshot(raw);
    },

    async save(doc, extra) {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      try {
        if (!hasRecoverableContent(doc.pages, doc.pageAudio)) {
          window.localStorage.removeItem(SESSION_RECOVERY_KEY);
          return true;
        }
        const snapshot: SessionSnapshotV1 = serializeSessionSnapshot(doc, extra);
        window.localStorage.setItem(SESSION_RECOVERY_KEY, JSON.stringify(snapshot));
        return true;
      } catch {
        return false; // quota exceeded / private-mode storage block
      }
    },

    async clear() {
      if (typeof window === 'undefined' || !window.localStorage) return;
      try {
        window.localStorage.removeItem(SESSION_RECOVERY_KEY);
      } catch {
        // non-fatal -- matches the monolith's try/catch-and-ignore on dismiss
      }
    },
  };
}

// Re-exported for callers that only need the pure pack helper (e.g. tests
// building synthetic snapshots) without pulling in the full adapter.
export { packCells };
