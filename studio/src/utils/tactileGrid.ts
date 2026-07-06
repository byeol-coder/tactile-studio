import {
  RESOLUTION_DIMS,
  type TactileCell,
  type TactileQuality,
  type TactileResolution,
} from '../types/tactile';

/** Create an all-off grid for the given resolution. */
export function createEmptyGrid(resolution: TactileResolution): TactileCell[] {
  const { width, height } = RESOLUTION_DIMS[resolution];
  const cells: TactileCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x, y, active: false });
    }
  }
  return cells;
}

/**
 * Deterministic placeholder conversion pipeline (v0).
 *
 * The real AI/OpenCV pipeline is not wired yet, so we synthesise a stable,
 * recognisable pattern seeded from the image name. This keeps the grid data
 * shape identical to what the real engine will produce, so the rest of the
 * app (preview, quality, export, send) can be built against it now.
 */
export function convertImageToGrid(
  seed: string,
  resolution: TactileResolution = '60x40',
): TactileCell[] {
  const { width, height } = RESOLUTION_DIMS[resolution];
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const radius = Math.min(width, height) * 0.42;

  // Cheap deterministic hash of the seed so different images look different.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const phase = (h % 360) * (Math.PI / 180);

  const cells: TactileCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      // A ringed / petal shape — clearly tactile-legible and seed-varied.
      const wobble = Math.cos(angle * 3 + phase) * (radius * 0.18);
      const active = Math.abs(dist - radius - wobble) < 2.1;
      cells.push({ x, y, active });
    }
  }
  return cells;
}

export type TactileShape = 'circle' | 'heart' | 'star' | 'arrow';

/**
 * Deterministic primitive shape generator (v0 mock for "원 그려줘" etc.).
 * Produces an outlined shape on the grid so the rest of the pipeline
 * (quality, export, send) can run against generated content too.
 */
export function drawShapeGrid(
  shape: TactileShape,
  resolution: TactileResolution = '60x40',
): TactileCell[] {
  const { width, height } = RESOLUTION_DIMS[resolution];
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const r = Math.min(width, height) * 0.4;
  const active = (x: number, y: number): boolean => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    switch (shape) {
      case 'circle':
        return Math.abs(dist - r) < 1.4;
      case 'star': {
        const ang = Math.atan2(dy, dx);
        const spikes = r * (0.72 + 0.28 * Math.cos(ang * 5));
        return Math.abs(dist - spikes) < 1.4;
      }
      case 'arrow': {
        const onShaft = Math.abs(dy) < 1.2 && dx < r * 0.5;
        const onHead =
          dx > r * 0.1 && dx < r * 0.7 && Math.abs(dy) < (r * 0.7 - dx) * 0.9;
        return onShaft || onHead;
      }
      case 'heart': {
        // Normalised heart implicit curve.
        const nx = dx / (r * 0.9);
        const ny = -(dy + r * 0.15) / (r * 0.9);
        const v = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny;
        return Math.abs(v) < 0.09;
      }
      default:
        return false;
    }
  };
  const cells: TactileCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({ x, y, active: active(x, y) });
    }
  }
  return cells;
}

/** Compute compact quality indicators for a converted grid. */
export function computeQuality(
  cells: TactileCell[],
  resolution: TactileResolution = '60x40',
): TactileQuality {
  const { width, height } = RESOLUTION_DIMS[resolution];
  const total = width * height;
  const activePins = cells.reduce((n, c) => (c.active ? n + 1 : n), 0);
  const density = total === 0 ? 0 : activePins / total;

  // Structural clarity: comfortable tactile density sits roughly 8–25%.
  let clarity: TactileQuality['clarity'] = 'medium';
  if (density < 0.04 || density > 0.45) clarity = 'low';
  else if (density >= 0.08 && density <= 0.28) clarity = 'high';

  // 60×40 maps cleanly to the DotPad 10×30 cell format; others need re-tiling.
  const dotPadCompatible = resolution === '60x40';

  return { activePins, density, clarity, dotPadCompatible };
}
