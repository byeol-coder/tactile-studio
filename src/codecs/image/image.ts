// src/codecs/image/image.ts
//
// Verbatim port of the monolith's image→tactile conversion numerics
// (_cvGray, _cvOtsu, _cvDown, _cvSobel, _cvDilate, _cvRemoveSmall, imgToCells,
// CONV_PRESETS). All of these operate on an already-decoded RGBA pixel buffer
// (the monolith's `_srcData`, which is `canvas.getContext('2d')
// .getImageData(...).data` — a browser-decoded image). Decoding a JPEG/PNG
// file into that RGBA buffer is a browser-only step (Image/canvas) and is
// NOT reimplemented or parity-tested here; everything downstream of it — the
// actual tactile-conversion algorithm — is fully pure and IS extracted and
// tested, using synthetic RGBA buffers as input (see tests/parity).
//
// Do not change the ink-preserving downscale bias (0.45×min + 0.55×mean), the
// Otsu plateau-handling (`(1 ± 1e-9)` tie rule), or the Sobel/dilate/remove-
// small neighbor conventions — they were tuned against real tactile output.

export interface CropRect { x: number; y: number; w: number; h: number }
export interface DownsampleResult { grid: Float32Array; box: { ox: number; oy: number; dw: number; dh: number } }
export interface ConvPreset { mode: 'fill' | 'edge'; invert: boolean; minCluster: number; dilateOutline: boolean; edgeBias: number }
export interface ConvOptions { preset?: keyof typeof CONV_PRESETS; threshold?: number; invert?: boolean; edge?: boolean }
export interface ConvResult { cells: Uint8Array; box: DownsampleResult['box'] | null; removedDots: number }

/** monolith CONV_PRESETS() */
export const CONV_PRESETS: Record<string, ConvPreset> = {
  balanced: { mode: 'fill', invert: false, minCluster: 2, dilateOutline: false, edgeBias: 0.00 },
  outline: { mode: 'edge', invert: false, minCluster: 2, dilateOutline: true, edgeBias: 0.10 },
  diagram: { mode: 'edge', invert: false, minCluster: 3, dilateOutline: false, edgeBias: 0.18 },
  detail: { mode: 'fill', invert: false, minCluster: 1, dilateOutline: false, edgeBias: 0.00 },
};

/** monolith _cvGray: RGBA (straight or premultiplied-over-white) → luminance grid. */
export function cvGray(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3] / 255;
    const R = rgba[i * 4] * a + 255 * (1 - a);
    const G = rgba[i * 4 + 1] * a + 255 * (1 - a);
    const B = rgba[i * 4 + 2] * a + 255 * (1 - a);
    g[i] = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }
  return g;
}

/** monolith _cvOtsu: between-class-variance threshold with the shipped plateau tie rule. */
export function cvOtsu(gray: Float32Array): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, gray[i] | 0))]++;
  const total = gray.length;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, maxVar = -1, first = 127, last = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (wB === 0) continue;
    const wF = total - wB; if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > maxVar * (1 + 1e-9)) { maxVar = v; first = t; last = t; }
    else if (v > maxVar * (1 - 1e-9)) { last = t; }
  }
  return Math.round((first + last) / 2);
}

/** monolith _cvDown: crop + ink-preserving block downscale (0.45×min + 0.55×mean). */
export function cvDown(gray: Float32Array, sw: number, sh: number, crop: CropRect | null, tw: number, th: number): DownsampleResult {
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  const cx = Math.max(0, Math.floor(c.x * sw)), cy = Math.max(0, Math.floor(c.y * sh));
  const cw = Math.max(1, Math.min(sw - cx, Math.round(c.w * sw)));
  const ch = Math.max(1, Math.min(sh - cy, Math.round(c.h * sh)));
  const scale = Math.min(tw / cw, th / ch);
  const dw = Math.max(1, Math.round(cw * scale)), dh = Math.max(1, Math.round(ch * scale));
  const ox = Math.floor((tw - dw) / 2), oy = Math.floor((th - dh) / 2);
  const out = new Float32Array(tw * th).fill(255);
  for (let ty = 0; ty < dh; ty++) for (let tx = 0; tx < dw; tx++) {
    const bx = Math.floor((tx * cw) / dw), by = Math.floor((ty * ch) / dh);
    const x0 = cx + bx, x1 = cx + Math.max(bx + 1, Math.floor(((tx + 1) * cw) / dw));
    const y0 = cy + by, y1 = cy + Math.max(by + 1, Math.floor(((ty + 1) * ch) / dh));
    let s = 0, n = 0, mn = 255;
    for (let yy = y0; yy < y1 && yy < sh; yy++) for (let xx = x0; xx < x1 && xx < sw; xx++) {
      const v = gray[yy * sw + xx]; s += v; n++; if (v < mn) mn = v;
    }
    out[(oy + ty) * tw + (ox + tx)] = n ? 0.45 * mn + 0.55 * (s / n) : 255;
  }
  return { grid: out, box: { ox, oy, dw, dh } };
}

/** monolith _cvSobel: 3×3 Sobel gradient magnitude (interior only; border stays 0). */
export function cvSobel(grid: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1], gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    let sx = 0, sy = 0, k = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const v = grid[(y + j) * w + (x + i)]; sx += v * gx[k]; sy += v * gy[k]; k++;
    }
    out[y * w + x] = Math.hypot(sx, sy);
  }
  return out;
}

/** monolith _cvDilate: 3×3 binary dilation (8-neighborhood, early-exit per pixel). */
export function cvDilate(cells: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let on = 0;
    for (let j = -1; j <= 1 && !on; j++) for (let i = -1; i <= 1; i++) {
      const nx = x + i, ny = y + j;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (cells[ny * w + nx]) { on = 1; break; }
    }
    out[y * w + x] = on;
  }
  return out;
}

/** monolith _cvRemoveSmall: 4-connected component size filter. */
export function cvRemoveSmall(cells: Uint8Array, w: number, h: number, minSize: number): { cells: Uint8Array; removed: number } {
  const seen = new Uint8Array(w * h), out = cells.slice();
  const stack: number[] = [];
  let removed = 0;
  for (let s = 0; s < w * h; s++) {
    if (!cells[s] || seen[s]) continue;
    stack.length = 0; stack.push(s); seen[s] = 1;
    const comp = [s];
    while (stack.length) {
      const p = stack.pop() as number, px = p % w, py = (p / w) | 0;
      const nb: Array<[number, number]> = [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (cells[q] && !seen[q]) { seen[q] = 1; stack.push(q); comp.push(q); }
      }
    }
    if (comp.length < minSize) { for (const q of comp) out[q] = 0; removed += comp.length; }
  }
  return { cells: out, removed };
}

/**
 * monolith imgToCells (RGBA-source branch only — the `!this._srcData` demo
 * fallback path (`catPattern`) is a UI convenience, not a codec concern, and
 * is intentionally not ported here). Reads an already-decoded RGBA buffer +
 * its dimensions; never touches a canvas itself.
 */
export function imgToCells(
  srcData: Uint8ClampedArray | Uint8Array, srcW: number, srcH: number,
  w: number, h: number, opts: ConvOptions = {}, crop: CropRect | null = null,
): ConvResult {
  const preset = CONV_PRESETS[opts.preset || 'balanced'] || CONV_PRESETS.balanced;
  const gray = cvGray(srcData, srcW, srcH);
  const down = cvDown(gray, srcW, srcH, crop, w, h);
  const grid = down.grid;
  const useEdge = opts.edge != null ? opts.edge : preset.mode === 'edge';
  let cells = new Uint8Array(w * h);
  try {
    if (useEdge) {
      const edges = cvSobel(grid, w, h);
      let max = 1; for (let i = 0; i < edges.length; i++) if (edges[i] > max) max = edges[i];
      const norm = new Float32Array(w * h);
      for (let i = 0; i < edges.length; i++) norm[i] = 255 - (edges[i] / max) * 255;
      const base = cvOtsu(norm);
      const thr = base - preset.edgeBias * 255 - ((opts.threshold != null ? opts.threshold - 50 : 0) * 1.2);
      for (let i = 0; i < norm.length; i++) cells[i] = norm[i] < thr ? 1 : 0;
      if (preset.dilateOutline) cells = cvDilate(cells, w, h);
    } else {
      const T = opts.threshold != null ? Math.round((opts.threshold / 100) * 255) : cvOtsu(grid);
      for (let i = 0; i < grid.length; i++) cells[i] = grid[i] < T ? 1 : 0;
    }
  } catch {
    const T = cvOtsu(grid);
    for (let i = 0; i < grid.length; i++) cells[i] = grid[i] < T ? 1 : 0;
  }
  if (opts.invert || preset.invert) for (let i = 0; i < cells.length; i++) cells[i] ^= 1;
  const clean = cvRemoveSmall(cells, w, h, preset.minCluster);
  return { cells: clean.cells, box: down.box, removedDots: clean.removed };
}
