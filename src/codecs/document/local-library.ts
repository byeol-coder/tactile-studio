// src/codecs/document/local-library.ts
//
// Verbatim port of the monolith's local "saved shelf" persistence
// (loadLibrary/saveLibrary, localStorage key 'ts.library.v1'). This is a
// DIFFERENT, simpler format than Library Asset v1 (scripts/tactile-library-
// asset.v1.schema.json) — a flat list of {name, loc, grid, thumb, hex} used
// for the in-app "saved projects" shelf, not the shareable asset schema.
//
// Only the pure serialize/deserialize transform is extracted here; the actual
// localStorage read/write becomes a StudioStorageAdapter concern in Phase 4
// (per the "Tactile Studio must not own cloud storage" / neutral-adapter
// requirement — local storage gets the same treatment as cloud storage).

import type { CellGrid } from '../../core/types.js';
import { decodeDtms60x40Hex, type TwEncodeBits, encodeDtmsHex } from '../dtms/dtms.js';

export interface SavedLibraryItem {
  name: string;
  loc: string;
  grid: string;   // e.g. '60×40' (note: full-width × separator, matches production strings)
  thumb: string;
  cells: CellGrid;
}

export interface SavedLibraryRecord {
  name?: string;
  loc?: string;
  grid?: string;
  thumb?: string;
  hex?: string;
}

/**
 * monolith saveLibrary(saved): dehydrate to the storable record shape.
 * Only 60×40 round-trips through 600-hex cleanly; any other grid keeps the
 * thumbnail only (hex: '') — this mirrors production exactly, it is not a
 * limitation introduced here.
 */
export function toSavedRecords(items: SavedLibraryItem[], encodeBits: TwEncodeBits): SavedLibraryRecord[] {
  return (items || []).map((it) => {
    const parts = String(it.grid || '60×40').split('×');
    const gw = +parts[0] || 60, gh = +parts[1] || 40;
    const hex = (gw === 60 && gh === 40 && it.cells) ? encodeDtmsHex(encodeBits, it.cells, 60, 40) : '';
    return { name: it.name, loc: it.loc, grid: it.grid, thumb: it.thumb || '', hex };
  });
}

/**
 * monolith loadLibrary(): rehydrate hex → cells (60×40 fixed / 2400 cells).
 * Tolerates legacy/missing fields with the same defaults as production;
 * invalid or non-string JSON simply yields an empty list (try/catch parity).
 */
export function fromSavedRecords(raw: unknown): SavedLibraryItem[] {
  let arr: unknown;
  try {
    arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((it: any) => {
    const cells = it && it.hex ? decodeDtms60x40Hex(it.hex) : null;
    return {
      name: it?.name || '',
      loc: it?.loc || 'drive',
      grid: it?.grid || '60×40',
      thumb: it?.thumb || '',
      cells: cells || new Uint8Array(2400),
    };
  }).filter(Boolean);
}
