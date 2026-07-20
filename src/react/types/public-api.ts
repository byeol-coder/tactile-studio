// src/react/types/public-api.ts
//
// The public, host-facing TypeScript surface for <TactileStudioEditor>.
// Matches the target shape from the migration spec:
//
//   <TactileStudioEditor
//     initialDocument={document}
//     services={{ storage, tactileDisplay, braille, imageProcessing }}
//     labels={labels}
//     theme={theme}
//     onChange={handleChange}
//     onSave={handleSave}
//     onDirtyChange={handleDirtyChange}
//     onError={handleError}
//   />
//
// No React import needed here — these are plain type contracts.

import type { StudioDocument } from '../../core/types.js';
import type { StudioStorageAdapter, SaveResult } from '../../storage/adapters/types.js';
import type { SessionRecoveryStorageAdapter } from '../../storage/adapters/session-recovery-storage-adapter.js';
import type { TactileDisplayAdapter } from '../../device/dotpad/types.js';
import type { CorpusRecord } from '../../codecs/corpus/types.js';

/** Host-provided braille service — a narrower surface than the full
 *  liblouis-node module (host may back this with the browser TSBraille
 *  adapter, the Node adapter, or its own implementation). */
export interface BrailleService {
  translate(text: string, langKey: string): Promise<{ ok: boolean; unicode: string; cells: number; reason?: string }>;
}

/** Host-provided image-processing service (imgToCells + friends), so Studio
 *  never assumes a specific decode pipeline is available. */
export interface ImageProcessingService {
  convert(
    srcData: Uint8ClampedArray, srcW: number, srcH: number,
    targetW: number, targetH: number,
    opts?: { preset?: string; threshold?: number; invert?: boolean },
    crop?: { x: number; y: number; w: number; h: number } | null,
  ): { cells: Uint8Array; removedDots: number };
}

/** Host-provided grid post-processing (thicken/denoise). Wraps the vendor
 *  TW.thickenBits/denoiseBits functions — Studio never reimplements them,
 *  it only orchestrates via codecs/grid-fx. */
export interface GridFxService {
  thicken(cells: Uint8Array, w: number, h: number, level: number): Uint8Array;
  denoise(cells: Uint8Array, w: number, h: number): Uint8Array;
}

/** Host-provided DTMS pin encoding (the real vendor TW.encodeBits — Studio
 *  never imports or reimplements it, see codecs/dtms). Required for DotPad
 *  "send" and DTMS/Library-Asset-v1 export to function; the editor renders
 *  fine without it, those two features are simply unavailable. Same shape
 *  as codecs/dtms's TwEncodeBits (bits[row][col], not a cells buffer). */
export type EncodeBitsFn = (bits: boolean[][], cols: number, rows: number) => string;

export interface StudioServices {
  storage: StudioStorageAdapter;
  tactileDisplay?: TactileDisplayAdapter;
  braille?: BrailleService;
  imageProcessing?: ImageProcessingService;
  gridFx?: GridFxService;
  encodeBits?: EncodeBitsFn;
  bitsToSvg?: (bits: boolean[][], cols: number, rows: number, opts?: { cell?: number; dotR?: number; title?: string }) => string;
  /** Static corpus data (typically the host's own real corpus.js, read from
   *  window.DTMS_CORPUS) — enables the corpus/command-panel search UI. No
   *  corpus data is bundled with or duplicated inside this package. */
  corpus?: CorpusRecord[];
  /** Crash-recovery autosave backend (browser localStorage-backed by
   *  default, key 'ts.session.v1' — see
   *  storage/adapters/session-recovery-storage-adapter.ts). Studio owns
   *  this local, ephemeral, non-cloud storage directly (same as the local
   *  library "saved shelf"), so unlike `storage` above there is no host
   *  requirement to provide one — TactileStudioEditor supplies the real
   *  adapter automatically unless this is set (e.g. for tests, or a host
   *  that wants to disable/relocate it). */
  sessionRecovery?: SessionRecoveryStorageAdapter;
}

/** Every user-facing string the editor needs. The host owns language
 *  switching entirely — Studio never detects browser language or ships an
 *  internal toggle. Optional fields fall back to English defaults defined
 *  inline in each consuming component (e.g. Toolbar.tsx's DEFAULT_TOOL_NAMES) —
 *  there is no single central labels-default module. */
export interface StudioLabels {
  toolNames?: Partial<Record<string, string>>;
  toolDesc?: Partial<Record<string, string>>;
  addPage?: string;
  pagesLabel?: string;
  undo?: string;
  redo?: string;
  [key: string]: unknown;
}

/** CSS custom-property values the host maps its own design tokens onto (see
 *  the migration spec's --ts-primary/--ts-bg/… token list). Providing a
 *  theme does not require also providing every token — unset tokens fall
 *  back to Studio's own defaults via CSS, not JS. */
export interface StudioTheme {
  [cssVariableName: string]: string | undefined;
}

export interface StudioErrorLike {
  code: string;
  message: string;
  cause?: unknown;
}

export interface TactileStudioEditorProps {
  initialDocument: StudioDocument;
  /** Opaque version that came with initialDocument from the host. When the
   *  storage adapter supports it, Studio returns it on save to avoid silently
   *  overwriting someone else's newer work. */
  initialVersion?: string;
  services: StudioServices;
  labels?: StudioLabels;
  theme?: StudioTheme;
  onChange?(document: StudioDocument): void;
  onSave?(document: StudioDocument): Promise<void> | void;
  /** A save was rejected because the host has a newer version. The editor
   *  deliberately does not auto-reload (that could discard local edits); the
   *  host chooses the next action such as compare, reload, or save-as-copy. */
  onSaveConflict?(document: StudioDocument, result: SaveResult): void;
  /** Called only when the user explicitly chooses Exit. Routing, unsaved-work
   *  prompts, and host navigation remain owned by the embedding product. */
  onExit?(): void;
  onDirtyChange?(dirty: boolean): void;
  onError?(error: StudioErrorLike): void;
  /** Called after an export completes and the browser download has been
   *  triggered (DTMS/Library-Asset-v1/SVG/PNG). Informational only — the
   *  host cannot cancel or modify the export from here; use it for
   *  analytics/logging, not for altering export behavior. */
  onExport?(result: { format: 'dtms' | 'library-asset-v1' | 'svg' | 'png'; filename: string }): void;
  /** Optional: render nothing until this resolves — lets a host defer mount
   *  until fonts/services are ready. Rarely needed; most hosts can omit it. */
  className?: string;
}
