import {
  RESOLUTION_DIMS,
  type TactileDocument,
  type TactileResolution,
} from '../types/tactile';
import { computeQuality, createEmptyGrid } from '../utils/tactileGrid';
import { hexToFrame } from '../model/frame';

let seq = 0;

/**
 * Parse an untrusted `tactileLayer` from the entry context into a canonical
 * {@link TactileDocument} (spec §B — lossless round-trip). Accepts either:
 *   - `{ resolution, cells: [{x,y,active}] }` (TactileDocument shape), or
 *   - `{ resolution, hex }` (DotPad column-major HEX).
 *
 * Everything is sanitized: unknown resolution → 60×40; the result is always a
 * dense, in-bounds grid (out-of-range / malformed cells are dropped). Returns
 * null only for structurally unusable input (not an object; no cells and no
 * valid hex), so bad parent data fails safely.
 */
export function parseTactileLayer(raw: unknown): TactileDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as { resolution?: unknown; cells?: unknown; hex?: unknown; title?: unknown };

  const resolution: TactileResolution =
    typeof d.resolution === 'string' && d.resolution in RESOLUTION_DIMS
      ? (d.resolution as TactileResolution)
      : '60x40';
  const { width, height } = RESOLUTION_DIMS[resolution];
  const grid = createEmptyGrid(resolution);

  const hasCells = Array.isArray(d.cells);
  const hasHex = typeof d.hex === 'string' && /^[0-9a-fA-F]+$/.test(d.hex);
  if (!hasCells && !hasHex) return null; // nothing loadable

  if (hasHex) {
    const frame = hexToFrame(d.hex as string, resolution);
    for (let i = 0; i < frame.bitmap.length; i++) {
      if (frame.bitmap[i]) grid[i].active = true;
    }
  } else {
    for (const entry of d.cells as unknown[]) {
      if (!entry || typeof entry !== 'object') continue;
      const cell = entry as { x?: unknown; y?: unknown; active?: unknown };
      const { x, y } = cell;
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
      if (x < 0 || y < 0 || x >= width || y >= height) continue; // drop out-of-bounds
      if (cell.active === true) grid[y * width + x].active = true;
    }
  }

  const now = new Date().toISOString();
  return {
    id: `doc-layer-${++seq}`,
    title: typeof d.title === 'string' && d.title ? d.title : '가져온 촉각 문서',
    resolution,
    cells: grid,
    quality: computeQuality(grid, resolution),
    createdAt: now,
    updatedAt: now,
  };
}
