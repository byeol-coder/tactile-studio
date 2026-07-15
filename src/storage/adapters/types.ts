// src/storage/adapters/types.ts
//
// Neutral storage interfaces (Phase 4 target). Tactile Studio must not own
// cloud storage, authentication, or publishing — the HOST (Tactile World)
// implements StudioStorageAdapter and passes it in. Studio never imports
// Supabase, never knows about a "graphics table", never makes a direct
// database call. This file defines the contract only.

import type { StudioDocument } from '../../core/types.js';

export interface SaveResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/** Host-implemented single-document persistence. */
export interface StudioStorageAdapter {
  load(id: string): Promise<StudioDocument>;
  save(document: StudioDocument): Promise<SaveResult>;
}

/** Host-implemented lifecycle callbacks — the editor reports out, the host
 *  decides what to do (persist, show a toast, log, redirect, …). */
export interface StudioHostCallbacks {
  onChange?(document: StudioDocument): void;
  onSave?(document: StudioDocument): Promise<void>;
  onExport?(result: unknown): void;
  onDirtyChange?(dirty: boolean): void;
  onError?(error: unknown): void;
}
