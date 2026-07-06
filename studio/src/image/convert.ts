import type { CursorPos } from '../a11y/cursor';

/**
 * Image → tactile grid conversion (spec Phase 2), pure and deterministic.
 *
 * Input is a grayscale luminance buffer (0=black … 255=white), length
 * `width*height`, row-major. Output is a boolean grid where `true` = raised pin.
 * Dark pixels raise pins (ink → dots); `invert` flips that. Thresholding is a
 * hard cut; Floyd–Steinberg adds error-diffusion dithering for tonal images.
 *
 * The DOM-dependent step (decode + scale an image file to this buffer) lives in
 * ./rasterize; this module is unit-testable without a canvas.
 */
export type DitherMode = 'none' | 'floyd-steinberg';

export interface ConvertOptions {
  /** 0–255 cut point: pixels darker than this raise a pin. */
  threshold: number;
  dither: DitherMode;
  /** Raise light pixels instead of dark ones. */
  invert?: boolean;
}

export function grayscaleToCells(
  gray: ArrayLike<number>,
  width: number,
  height: number,
  opts: ConvertOptions,
): boolean[] {
  const { threshold, dither, invert = false } = opts;
  const out: boolean[] = new Array(width * height).fill(false);
  const raised = (dark: boolean) => (invert ? !dark : dark);

  if (dither !== 'floyd-steinberg') {
    for (let i = 0; i < out.length; i++) out[i] = raised(gray[i] < threshold);
    return out;
  }

  // Floyd–Steinberg: quantize to black/white at `threshold`, diffuse the error.
  const buf = Float32Array.from(gray as ArrayLike<number>);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = buf[i];
      const quant = old < threshold ? 0 : 255;
      const err = old - quant;
      out[i] = raised(quant === 0);
      if (x + 1 < width) buf[i + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x - 1 >= 0) buf[i + width - 1] += (err * 3) / 16;
        buf[i + width] += (err * 5) / 16;
        if (x + 1 < width) buf[i + width + 1] += (err * 1) / 16;
      }
    }
  }
  return out;
}

/** Collect the raised cells of a boolean grid as coordinates. */
export function activeCoords(cells: boolean[], width: number): CursorPos[] {
  const out: CursorPos[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) out.push({ x: i % width, y: Math.floor(i / width) });
  }
  return out;
}
