import { RESOLUTION_DIMS, type TactileCell, type TactileDocument, type TactileResolution } from '../types/tactile';

/**
 * Normalized bitmap bridge between the sparse {@link TactileDocument} model and
 * the dense, resolution-shaped representation every output adapter consumes.
 *
 * A bitmap is a flat `Uint8Array` of `width * height`, indexed `y * width + x`,
 * where a non-zero value means the pin is raised. This mirrors the layout used
 * by the proven vanilla engine (`js/engine.js`) so encodings are byte-identical
 * across the two apps.
 */
export interface TactileFrame {
  resolution: TactileResolution;
  width: number;
  height: number;
  bitmap: Uint8Array;
}

/** Build a dense frame from a document's sparse cell list. */
export function docToFrame(doc: TactileDocument): TactileFrame {
  const { width, height } = RESOLUTION_DIMS[doc.resolution];
  const bitmap = new Uint8Array(width * height);
  for (const cell of doc.cells) {
    if (!cell.active) continue;
    if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= height) continue;
    bitmap[cell.y * width + cell.x] = 1;
  }
  return { resolution: doc.resolution, width, height, bitmap };
}

/** Rebuild a sparse cell list (all cells, active flag set) from a bitmap. */
export function frameToCells(frame: TactileFrame): TactileCell[] {
  const { width, height, bitmap } = frame;
  const cells: TactileCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x, y, active: bitmap[y * width + x] !== 0 });
    }
  }
  return cells;
}

// ─── Dot Pad column-major HEX codec ──────────────────────────────
// Ported byte-for-byte from js/engine.js. Each 2×4 cell packs 8 pins into one
// byte; the bit index for a local pin (lx∈0..1, ly∈0..3) is `lx*4 + ly`. Cells
// are emitted row-major (cellRow outer, cellCol inner).
export const dotBit = (lx: number, ly: number): number => lx * 4 + ly;

/** Encode a frame to the Dot Pad HEX string (2 hex chars per cell byte). */
export function frameToHex(frame: TactileFrame): string {
  const { width: cols, height: rows, bitmap } = frame;
  const cc = (cols / 2) | 0;
  const cr = (rows / 4) | 0;
  let hex = '';
  for (let r = 0; r < cr; r++) {
    for (let c = 0; c < cc; c++) {
      let b = 0;
      for (let lx = 0; lx < 2; lx++) {
        for (let ly = 0; ly < 4; ly++) {
          const x = c * 2 + lx;
          const y = r * 4 + ly;
          if (bitmap[y * cols + x]) b |= 1 << dotBit(lx, ly);
        }
      }
      hex += b.toString(16).padStart(2, '0').toUpperCase();
    }
  }
  return hex;
}

/** Decode a Dot Pad HEX string back into a frame for the given resolution. */
export function hexToFrame(hex: string, resolution: TactileResolution): TactileFrame {
  const { width: cols, height: rows } = RESOLUTION_DIMS[resolution];
  const cc = (cols / 2) | 0;
  const cr = (rows / 4) | 0;
  const bitmap = new Uint8Array(cols * rows);
  let idx = 0;
  for (let r = 0; r < cr; r++) {
    for (let c = 0; c < cc; c++) {
      const b = parseInt(hex.substr(idx * 2, 2), 16) || 0;
      idx++;
      for (let lx = 0; lx < 2; lx++) {
        for (let ly = 0; ly < 4; ly++) {
          if ((b >> dotBit(lx, ly)) & 1) {
            const x = c * 2 + lx;
            const y = r * 4 + ly;
            bitmap[y * cols + x] = 1;
          }
        }
      }
    }
  }
  return { resolution, width: cols, height: rows, bitmap };
}

/** Byte length of the HEX payload for a resolution (60×40 → 300, 96×64 → 768). */
export function frameByteLength(resolution: TactileResolution): number {
  const { width, height } = RESOLUTION_DIMS[resolution];
  return ((width / 2) | 0) * ((height / 4) | 0);
}
