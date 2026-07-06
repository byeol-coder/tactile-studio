import type { TactileDocument } from '../../types/tactile';
import { dotPadAdapter } from './DotPadAdapter';
import type { DeviceEvents, DeviceHandle, EncodedFrame } from '../types';

/**
 * DotPad connection session — the single owner of the live device handle.
 *
 * A physical DotPad is one global resource, and the connection/send hooks are
 * separate React hook instances that must share the same handle. Rather than
 * duplicate mock timers in each hook, both drive this module, which delegates
 * to {@link dotPadAdapter}. Connection status is reported through the adapter's
 * `onStatus` events (not fabricated in the UI), and sends go through the
 * adapter's encode + line-diff path.
 *
 * Phase 3 swaps only `dotPadAdapter.connect()` for the real DotPadSDK
 * transport; this module and the hooks above it stay unchanged.
 */
let handle: DeviceHandle | null = null;
let lastSentFrame: EncodedFrame | null = null;

export function isConnected(): boolean {
  return handle !== null;
}

/** Open a connection (idempotent). Status flows via `events.onStatus`. */
export async function connect(events?: DeviceEvents): Promise<void> {
  if (handle) {
    events?.onStatus?.('connected', handle.name);
    return;
  }
  handle = await dotPadAdapter.connect(events);
  lastSentFrame = null;
}

/** Close the connection. Emits a `disconnected` status via the handle. */
export async function disconnect(): Promise<void> {
  const active = handle;
  handle = null;
  lastSentFrame = null;
  if (active) await active.disconnect();
}

/**
 * Encode a document and stream it to the device using the line-diff path, so
 * only changed cells would be written once a real transport exists. Throws if
 * no device is connected.
 */
export async function sendDocument(doc: TactileDocument): Promise<void> {
  if (!handle) throw new Error('DotPad not connected');
  const next = dotPadAdapter.encode(doc);
  await handle.sendDiff(lastSentFrame, next);
  lastSentFrame = next;
}

/** Cells (`y*width+x`) that the next send of `doc` would update on the device. */
export function pendingChanges(doc: TactileDocument): number[] {
  return dotPadAdapter.diff(lastSentFrame, dotPadAdapter.encode(doc));
}

/** Test/reset helper: forget any live handle and the last sent frame. */
export function resetSession(): void {
  handle = null;
  lastSentFrame = null;
}
