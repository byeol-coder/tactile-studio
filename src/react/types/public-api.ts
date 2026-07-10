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
import type { StudioStorageAdapter } from '../../storage/adapters/types.js';
import type { TactileDisplayAdapter } from '../../device/dotpad/types.js';

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
  ): { cells: Uint8Array; removedDots: number };
}

export interface StudioServices {
  storage: StudioStorageAdapter;
  tactileDisplay?: TactileDisplayAdapter;
  braille?: BrailleService;
  imageProcessing?: ImageProcessingService;
}

/** Every user-facing string the editor needs. The host owns language
 *  switching entirely — Studio never detects browser language or ships an
 *  internal toggle (see docs/ARCHITECTURE notes). Optional fields fall back
 *  to the English defaults in react/labels-default.ts. */
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
  services: StudioServices;
  labels?: StudioLabels;
  theme?: StudioTheme;
  onChange?(document: StudioDocument): void;
  onSave?(document: StudioDocument): Promise<void> | void;
  onDirtyChange?(dirty: boolean): void;
  onError?(error: StudioErrorLike): void;
  /** Optional: render nothing until this resolves — lets a host defer mount
   *  until fonts/services are ready. Rarely needed; most hosts can omit it. */
  className?: string;
}
