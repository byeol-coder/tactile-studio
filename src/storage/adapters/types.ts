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
  /** Opaque revision returned by the host after a successful write. Pass it
   *  back on the next save to prevent a stale editor from overwriting a newer
   *  server copy. Studio never interprets this value. */
  version?: string;
  /** A rejected optimistic write. The editor keeps its local work dirty and
   *  lets the host decide whether to reload, merge, or save a copy. */
  conflict?: boolean;
  remoteVersion?: string;
  error?: string;
}

export interface SaveOptions {
  /** Version last observed by this editor instance, if the host supports
   *  optimistic concurrency. Omit for create-only or legacy backends. */
  expectedVersion?: string;
}

/** Host-implemented single-document persistence. */
export interface StudioStorageAdapter {
  load(id: string): Promise<StudioDocument>;
  save(document: StudioDocument, options?: SaveOptions): Promise<SaveResult>;
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
