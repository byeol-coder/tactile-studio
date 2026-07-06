import type { TactileDocument, TactileResolution } from '../types/tactile';
import type { TactileFrame } from '../model/frame';

/**
 * Output-adapter contracts.
 *
 * The single structural rule of Tactile Studio (build spec §4): the
 * {@link TactileDocument} model is device-agnostic, and every way of getting it
 * *out* — a refreshable display, an embosser, an on-screen preview — is a
 * pluggable adapter over that model. Editing tools mutate the document only;
 * they never know or care which adapters exist.
 *
 * Adding a new printer/display = implementing one of these interfaces and
 * registering it (see ./registry). Zero editor changes.
 */

/** A file produced by an {@link OutputAdapter}, ready to download. */
export interface FileExport {
  filename: string;
  mime: string;
  blob: Blob;
}

/** A frame encoded for a specific refreshable device. */
export interface EncodedFrame {
  resolution: TactileResolution;
  /** Device HEX payload (column-major, `lx*4+ly` packing). */
  hex: string;
  /** Raw bytes backing the HEX payload. */
  bytes: Uint8Array;
  /** The dense frame this was encoded from (kept for diffing/preview). */
  frame: TactileFrame;
}

/** Live connection lifecycle callbacks a device adapter may emit. */
export interface DeviceEvents {
  onStatus?: (status: 'connecting' | 'connected' | 'disconnected' | 'error', detail?: string) => void;
}

/** A live handle to a connected device. */
export interface DeviceHandle {
  readonly name: string;
  /** Push a full frame. Returns the bytes actually transmitted. */
  send(frame: EncodedFrame): Promise<void>;
  /** Push only changed cells since the last frame (line-diff streaming). */
  sendDiff(prev: EncodedFrame | null, next: EncodedFrame): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Adapter for a refreshable tactile *display* (streams live, e.g. DotPad).
 * Encoding is real and testable even when the transport is mocked.
 */
export interface DeviceAdapter {
  readonly id: string;
  readonly label: string;
  /** Native resolutions this device renders. */
  readonly resolutions: readonly TactileResolution[];
  supports(resolution: TactileResolution): boolean;
  /** Pure, deterministic: model → wire encoding. */
  encode(doc: TactileDocument): EncodedFrame;
  /** Flat cell indices (`y*width+x`) that differ between two frames. */
  diff(prev: EncodedFrame | null, next: EncodedFrame): number[];
  /** Open a transport (may be mocked); resolves to a live handle. */
  connect(events?: DeviceEvents): Promise<DeviceHandle>;
}

/**
 * Adapter for a *file/printer* target (embosser, swell paper, braille).
 * One adapter may expose several formats (e.g. svg, pdf, brf).
 */
export interface OutputAdapter {
  readonly id: string;
  readonly label: string;
  readonly formats: readonly string[];
  /** Encode the document into a downloadable file of the requested format. */
  export(doc: TactileDocument, format: string): FileExport;
}

/** Options controlling how a preview renderer paints. */
export interface PreviewOptions {
  /** Pixels per pin. */
  cellPx?: number;
  /** Draw the inactive pin grid faintly. */
  showGrid?: boolean;
  dotColor?: string;
  gridColor?: string;
  background?: string;
}

/** Adapter that paints the model onto a 2D canvas context for on-screen use. */
export interface PreviewRenderer {
  readonly id: string;
  draw(doc: TactileDocument, ctx: CanvasRenderingContext2D, opts?: PreviewOptions): void;
}
