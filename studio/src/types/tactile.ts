export type CanvasStatus =
  | 'empty'
  | 'image-imported'
  | 'converting'
  | 'converted'
  | 'send-ready'
  | 'sending'
  | 'sent'
  | 'error';

export type TactileResolution = '60x40' | '96x64' | '28x40';

export interface TactileCell {
  x: number;
  y: number;
  active: boolean;
}

export interface TactileQuality {
  /** Number of raised pins. */
  activePins: number;
  /** Ratio of active pins to total pins, 0–1. */
  density: number;
  /** Coarse structural clarity bucket. */
  clarity: 'low' | 'medium' | 'high';
  /** Whether the grid maps cleanly to DotPad export format. */
  dotPadCompatible: boolean;
}

export interface TactileDocument {
  id: string;
  title: string;
  resolution: TactileResolution;
  cells: TactileCell[];
  sourceImageName?: string;
  quality?: TactileQuality;
  createdAt: string;
  updatedAt: string;
}

/** Pixel dimensions for a resolution string. */
export const RESOLUTION_DIMS: Record<TactileResolution, { width: number; height: number }> = {
  '60x40': { width: 60, height: 40 },
  '96x64': { width: 96, height: 64 },
  '28x40': { width: 28, height: 40 },
};
