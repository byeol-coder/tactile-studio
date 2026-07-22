// src/codecs/document/session-snapshot.ts
//
// Verbatim port of the monolith's crash-recovery autosave (_saveSession /
// _loadSession / _applySession, localStorage key 'ts.session.v1'), added to
// vanilla `main` in `ecb67e3` ("feat(studio): persist sessions and add
// mobile page pager", 2026-07-13) -- AFTER this migration branch's fork
// point (40f7647, 2026-07-10). There is no earlier version of this feature
// anywhere in this branch's history; this is a first-time port, not a
// resync (see docs/known-issues.md #7/#8, which flagged this as an
// unported feature rather than a bug).
//
// Only the pure encode/decode/validate transform lives here, matching the
// established split for local-library (codecs/document/local-library.ts +
// storage/adapters/local-library-storage-adapter.ts): the actual
// localStorage read/write is a storage-adapter concern (Phase 4 pattern),
// injectable and mockable.
//
// UNLIKE local-library (#7), this is NOT a verbatim-bug-included port: the
// monolith's _saveSession swallows storage failures with no signal to the
// caller (the same silent-failure class as the pre-fix saveLibrary). Since
// this feature has no prior shipped version in this branch to be faithful
// to, it is built with the already-known-correct contract from the start
// (adapter.save() resolves boolean), the same way the Save-button flow
// (StudioStorageAdapter) was built correctly from scratch in Phase 5 rather
// than re-introducing a bug that happens to exist elsewhere.

import type { CellGrid, PageMap, StudioDocument } from '../../core/types.js';

/** monolith pageAudio[i] shape, minus the in-memory object URL (see below). */
export interface SessionPageAudioEntry {
  desc?: string;
  narration?: string;
  brl?: string;
  [key: string]: unknown;
}

/** The JSON-serializable snapshot written to storage (pages as base64, not
 *  live buffers) -- monolith's _serializeSession() output shape. */
export interface SessionSnapshotV1 {
  v: 1;
  savedAt: number;
  gridW: number;
  gridH: number;
  output: '60' | '96';
  pageIndex: number;
  fileName: string | null;
  brailleLang: string;
  pages: string[]; // base64-packed bits, one per page
  audio: PageMap<SessionPageAudioEntry>;
  vectors: PageMap<unknown[]>;
  titles: PageMap<string>;
}

/** The snapshot after loading + unpacking + "worth restoring" validation --
 *  monolith's _loadSession() return shape (raw fields plus `_pages`, the
 *  live Uint8Array buffers ready to hand to the store). */
export interface ParsedSessionSnapshot extends SessionSnapshotV1 {
  pages: string[];     // still the original base64 strings (kept for fidelity)
  liveCells: CellGrid[]; // unpacked, ready-to-restore buffers (monolith: snap._pages)
}

/** monolith _packCells(cells): bit-pack a CellGrid into a base64 string.
 *  Never throws -- returns '' if btoa itself is unavailable (matches
 *  the shipped try/catch-and-empty-string fallback exactly). */
export function packCells(cells: CellGrid): string {
  const n = cells.length;
  const bytes = new Uint8Array((n + 7) >> 3);
  for (let i = 0; i < n; i++) if (cells[i]) bytes[i >> 3] |= (1 << (i & 7));
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  try {
    return btoa(s);
  } catch {
    return '';
  }
}

/** monolith _unpackCells(b64, len): inverse of packCells. Never throws --
 *  returns an all-zero buffer of the requested length on any decode error
 *  (matches the shipped try/catch-and-zeros fallback exactly). */
export function unpackCells(b64: string, len: number): CellGrid {
  const out = new Uint8Array(len);
  try {
    const s = atob(b64);
    for (let i = 0; i < len; i++) if (s.charCodeAt(i >> 3) & (1 << (i & 7))) out[i] = 1;
  } catch {
    // fall through with the all-zero buffer already allocated
  }
  return out;
}

/** monolith _hasContent(): is there anything actually worth persisting a
 *  crash-recovery snapshot for? True if there's more than one page, any lit
 *  dot anywhere, or any page-audio narration/description/attachment. */
export function hasRecoverableContent(pages: CellGrid[], pageAudio: PageMap<unknown>): boolean {
  if (pages.length > 1) return true;
  for (const p of pages) {
    for (let i = 0; i < p.length; i++) if (p[i]) return true;
  }
  for (const k in pageAudio) {
    const r = pageAudio[k] as SessionPageAudioEntry | undefined;
    if (r && (r.narration || r.desc || r.src)) return true;
  }
  return false;
}

/** monolith _serializeSession(): build the JSON-serializable snapshot from
 *  the live document. Drops each page-audio entry's `_url` (an in-memory
 *  object URL, invalid after reload) while keeping the rest of the entry --
 *  matches the shipped `const { _url, ...rest } = r` destructure exactly. */
export function serializeSessionSnapshot(
  doc: StudioDocument,
  extra: { brailleLang: string },
): SessionSnapshotV1 {
  const audio: PageMap<SessionPageAudioEntry> = {};
  const src = (doc.pageAudio || {}) as PageMap<SessionPageAudioEntry & { _url?: unknown }>;
  for (const k in src) {
    const r = src[k];
    if (!r) continue;
    const { _url, ...rest } = r;
    audio[k] = rest;
  }
  return {
    v: 1,
    savedAt: Date.now(),
    gridW: doc.grid.w,
    gridH: doc.grid.h,
    output: doc.grid.w === 96 ? '96' : '60',
    pageIndex: doc.pageIndex,
    fileName: doc.title || null,
    brailleLang: extra.brailleLang,
    pages: doc.pages.map((c) => packCells(c)),
    audio,
    vectors: (doc.pageVectors || {}) as PageMap<unknown[]>,
    titles: (doc.pageTitles || {}) as PageMap<string>,
  };
}

/** monolith _loadSession(): parse raw JSON from storage, unpack pages, and
 *  apply the "worth restoring" gate (recoverable = a dot anywhere, a
 *  multi-page doc, or saved narration/desc/attachment) -- returns null for
 *  anything malformed or not worth offering, exactly like the shipped
 *  try/catch-and-null fallback. Pure/synchronous; the caller (the storage
 *  adapter) is responsible for the actual localStorage.getItem() call and
 *  any I/O-level error handling. */
export function parseSessionSnapshot(raw: string): ParsedSessionSnapshot | null {
  try {
    const snap = JSON.parse(raw);
    if (!snap || !Array.isArray(snap.pages) || !snap.pages.length) return null;
    const gw = +snap.gridW || 60;
    const gh = +snap.gridH || 40;
    const len = gw * gh;
    const liveCells = snap.pages.map((b64: string) => unpackCells(b64, len));

    let worth = liveCells.length > 1;
    if (!worth) {
      for (const p of liveCells) {
        for (let i = 0; i < p.length; i++) if (p[i]) { worth = true; break; }
        if (worth) break;
      }
    }
    if (!worth) {
      const audio = snap.audio || {};
      for (const k in audio) {
        const r = audio[k];
        if (r && (r.narration || r.desc || r.src)) { worth = true; break; }
      }
    }
    if (!worth) return null;

    return { ...snap, gridW: gw, gridH: gh, liveCells } as ParsedSessionSnapshot;
  } catch {
    return null;
  }
}
