import { normalizeConversionState } from '@dot/tactile-contract';

/**
 * @typedef {import('@dot/tactile-contract').ConversionState} ConversionState
 * @typedef {import('@dot/tactile-contract').SourceImageState} SourceImageState
 */

/**
 * @param {number} cols
 * @param {number} rows
 */
export function makeGrid(cols, rows) {
  validateShape(cols, rows);
  return { cols, rows, n: cols * rows, cc: (cols / 2) | 0, cr: (rows / 4) | 0 };
}

/**
 * Convert target-sized RGBA pixels into the grayscale/alpha buffers consumed by
 * the pure tactile engine. Transparent pixels are composited over white, matching
 * the source browser engine's RGBA-to-grayscale behavior.
 *
 * @param {Uint8ClampedArray | Uint8Array | number[]} rgba
 * @param {number} cols
 * @param {number} rows
 * @returns {SourceImageState}
 */
export function createSourceImageStateFromRgba(rgba, cols, rows) {
  validateShape(cols, rows);
  const n = cols * rows;
  if (rgba.length !== n * 4) {
    throw new RangeError(`rgba length ${rgba.length} does not match ${n * 4}`);
  }
  const grayBuf = new Uint8ClampedArray(n);
  const alphaBuf = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const base = i * 4;
    const r = Number(rgba[base]);
    const g = Number(rgba[base + 1]);
    const b = Number(rgba[base + 2]);
    const a = Number(rgba[base + 3]);
    alphaBuf[i] = a;
    const af = a / 255;
    const rr = r * af + 255 * (1 - af);
    const gg = g * af + 255 * (1 - af);
    const bb = b * af + 255 * (1 - af);
    grayBuf[i] = Math.round(0.2126 * rr + 0.7152 * gg + 0.0722 * bb);
  }
  return { grayBuf, alphaBuf };
}

export const createSourceImageState = createSourceImageStateFromRgba;

/**
 * @param {Uint8ClampedArray | Uint8Array | number[]} grayBuf
 * @param {Uint8ClampedArray | Uint8Array | number[]} alphaBuf
 * @param {number} cols
 * @param {number} rows
 */
export function analyzeImageType(grayBuf, alphaBuf, cols, rows) {
  validateShape(cols, rows);
  validateLength(grayBuf, cols * rows, 'grayBuf');
  validateLength(alphaBuf, cols * rows, 'alphaBuf');
  const n = cols * rows;
  let hasAlpha = false;
  let white = 0;
  let dark = 0;
  let edges = 0;
  let midLight = 0;
  const hist = new Array(256).fill(0);

  for (let i = 0; i < n; i++) {
    if (Number(alphaBuf[i]) < 200) hasAlpha = true;
    const v = Number(grayBuf[i]) | 0;
    hist[v]++;
    if (v > 220) white++;
    if (v < 50) dark++;
    if (v > 180 && v <= 220) midLight++;
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (x + 1 < cols && Math.abs(Number(grayBuf[i]) - Number(grayBuf[i + 1])) > 35) edges++;
      if (y + 1 < rows && Math.abs(Number(grayBuf[i]) - Number(grayBuf[i + cols])) > 35) edges++;
    }
  }

  let acc = 0;
  let p5 = 0;
  let p95 = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (!p5 && acc >= n * 0.05) p5 = v;
    if (acc >= n * 0.95) {
      p95 = v;
      break;
    }
  }

  const whiteR = white / n;
  const darkR = dark / n;
  const edgeR = edges / (2 * n);
  const brightR = (white + midLight) / n;
  const spread = p95 - p5;
  let type = 'photo';
  if (hasAlpha) type = 'transparent';
  else if (brightR > 0.60 && darkR < 0.35 && (edgeR < 0.50 || brightR > 0.70)) type = 'lineart';
  else if (spread < 60) type = 'lowcontrast';
  else if (whiteR + darkR > 0.85) type = 'lineart';
  return { hasAlpha, whiteR, darkR, edgeR, spread, brightR, type };
}

/**
 * @param {Uint8ClampedArray | Uint8Array | number[]} grayBuf
 */
function otsu(grayBuf) {
  const h = new Array(256).fill(0);
  for (const v of grayBuf) h[Number(v) | 0]++;
  const N = grayBuf.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * h[i];
  let sB = 0;
  let wB = 0;
  let mx = -1;
  let t = 128;
  for (let i = 0; i < 256; i++) {
    wB += h[i];
    if (!wB) continue;
    const wF = N - wB;
    if (!wF) break;
    sB += i * h[i];
    const mB = sB / wB;
    const mF = (sum - sB) / wF;
    const b = wB * wF * (mB - mF) ** 2;
    if (b > mx) {
      mx = b;
      t = i;
    }
  }
  return t;
}

export const otsuThreshold = otsu;

/**
 * @param {Uint8ClampedArray | Uint8Array | number[]} grayBuf
 */
function meanT(grayBuf) {
  let s = 0;
  for (const v of grayBuf) s += Number(v);
  return s / grayBuf.length;
}

/**
 * @param {Uint8ClampedArray | Uint8Array | number[]} grayBuf
 * @param {number} t
 * @param {boolean} invert
 * @param {number} cols
 * @param {number} rows
 */
function fillT(grayBuf, t, invert, cols, rows) {
  const o = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    let on = Number(grayBuf[i]) <= t ? 1 : 0;
    if (invert) on ^= 1;
    o[i] = on;
  }
  return o;
}

/**
 * @param {Uint8ClampedArray | Uint8Array | number[]} grayBuf
 * @param {number} cols
 * @param {number} rows
 */
function integral(grayBuf, cols, rows) {
  const W = cols + 1;
  const I = new Float64Array(W * (rows + 1));
  const I2 = new Float64Array(W * (rows + 1));
  for (let y = 1; y <= rows; y++) {
    for (let x = 1; x <= cols; x++) {
      const v = Number(grayBuf[(y - 1) * cols + (x - 1)]);
      I[y * W + x] = v + I[(y - 1) * W + x] + I[y * W + x - 1] - I[(y - 1) * W + x - 1];
      I2[y * W + x] = v * v + I2[(y - 1) * W + x] + I2[y * W + x - 1] - I2[(y - 1) * W + x - 1];
    }
  }
  return { I, I2, W };
}

/**
 * @param {{ I: Float64Array, I2: Float64Array, W: number }} II
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
function box(II, x0, y0, x1, y1) {
  const { I, I2, W } = II;
  const s = I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0];
  const s2 = I2[y1 * W + x1] - I2[y0 * W + x1] - I2[y1 * W + x0] + I2[y0 * W + x0];
  const n = (x1 - x0) * (y1 - y0);
  const m = s / n;
  const v = Math.max(0, s2 / n - m * m);
  return { m, sd: Math.sqrt(v) };
}

/**
 * @param {Uint8ClampedArray | Uint8Array | number[]} grayBuf
 * @param {number} win
 * @param {number} C
 * @param {boolean} invert
 * @param {number} cols
 * @param {number} rows
 */
function adaptiveFill(grayBuf, win, C, invert, cols, rows) {
  const II = integral(grayBuf, cols, rows);
  const o = new Uint8Array(cols * rows);
  const r = win >> 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const x0 = Math.max(0, x - r);
      const y0 = Math.max(0, y - r);
      const x1 = Math.min(cols, x + r + 1);
      const y1 = Math.min(rows, y + r + 1);
      const { m } = box(II, x0, y0, x1, y1);
      let on = Number(grayBuf[y * cols + x]) <= (m - C) ? 1 : 0;
      if (invert) on ^= 1;
      o[y * cols + x] = on;
    }
  }
  return o;
}

/**
 * @param {Uint8ClampedArray | Uint8Array | number[]} grayBuf
 * @param {number} win
 * @param {number} k
 * @param {boolean} invert
 * @param {number} cols
 * @param {number} rows
 */
function sauvolaFill(grayBuf, win, k, invert, cols, rows) {
  const II = integral(grayBuf, cols, rows);
  const o = new Uint8Array(cols * rows);
  const r = win >> 1;
  const R = 128;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const x0 = Math.max(0, x - r);
      const y0 = Math.max(0, y - r);
      const x1 = Math.min(cols, x + r + 1);
      const y1 = Math.min(rows, y + r + 1);
      const { m, sd } = box(II, x0, y0, x1, y1);
      const T = m * (1 + k * ((sd / R) - 1));
      let on = Number(grayBuf[y * cols + x]) <= T ? 1 : 0;
      if (invert) on ^= 1;
      o[y * cols + x] = on;
    }
  }
  return o;
}

/**
 * @param {Uint8ClampedArray | Uint8Array | number[]} alphaBuf
 * @param {boolean} invert
 * @param {number} n
 */
function alphaMask(alphaBuf, invert, n) {
  const o = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let on = Number(alphaBuf[i]) >= 128 ? 1 : 0;
    if (invert) on ^= 1;
    o[i] = on;
  }
  return o;
}

/**
 * @param {Uint8Array} grid
 * @param {number} x
 * @param {number} y
 * @param {number} cols
 * @param {number} rows
 * @param {boolean} diag
 */
function nb(grid, x, y, cols, rows, diag) {
  let n = 0;
  const d = diag
    ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [a, b] of d) {
    const nx = x + a;
    const ny = y + b;
    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && grid[ny * cols + nx]) n++;
  }
  return n;
}

/**
 * @param {Uint8Array} grid
 * @param {number} cols
 * @param {number} rows
 */
function erode4(grid, cols, rows) {
  const o = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      o[i] = grid[i] && nb(grid, x, y, cols, rows, false) === 4 ? 1 : 0;
    }
  }
  return o;
}

/**
 * @param {Uint8Array} grid
 * @param {number} cols
 * @param {number} rows
 */
function dilate4(grid, cols, rows) {
  const o = new Uint8Array(grid);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!grid[y * cols + x]) continue;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + a;
        const ny = y + b;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) o[ny * cols + nx] = 1;
      }
    }
  }
  return o;
}

/**
 * @param {Uint8ClampedArray | Uint8Array | number[]} grayBuf
 * @param {number} cols
 * @param {number} rows
 * @param {number} [thr]
 */
function sobelEdge(grayBuf, cols, rows, thr = 40) {
  const o = new Uint8Array(cols * rows);
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const Gx =
        -Number(grayBuf[(y - 1) * cols + (x - 1)]) - 2 * Number(grayBuf[y * cols + (x - 1)]) - Number(grayBuf[(y + 1) * cols + (x - 1)])
        + Number(grayBuf[(y - 1) * cols + (x + 1)]) + 2 * Number(grayBuf[y * cols + (x + 1)]) + Number(grayBuf[(y + 1) * cols + (x + 1)]);
      const Gy =
        -Number(grayBuf[(y - 1) * cols + (x - 1)]) - 2 * Number(grayBuf[(y - 1) * cols + x]) - Number(grayBuf[(y - 1) * cols + (x + 1)])
        + Number(grayBuf[(y + 1) * cols + (x - 1)]) + 2 * Number(grayBuf[(y + 1) * cols + x]) + Number(grayBuf[(y + 1) * cols + (x + 1)]);
      if (Math.sqrt(Gx * Gx + Gy * Gy) > thr) o[y * cols + x] = 1;
    }
  }
  return o;
}

/**
 * @param {Uint8Array} grid
 * @param {number} cols
 * @param {number} rows
 */
function denoiseG(grid, cols, rows) {
  const o = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      o[y * cols + x] = grid[y * cols + x] && nb(grid, x, y, cols, rows, true) >= 2 ? 1 : 0;
    }
  }
  return o;
}

/**
 * @param {Uint8Array} grid
 * @param {number} cols
 * @param {number} rows
 * @param {boolean} diag
 */
export function components(grid, cols, rows, diag) {
  validateShape(cols, rows);
  validateLength(grid, cols * rows, 'grid');
  const lab = new Int16Array(cols * rows).fill(-1);
  const sizes = [];
  let id = 0;
  /** @type {number[]} */
  const st = [];
  /** @type {Array<[number, number]>} */
  const dirs = diag
    ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < cols * rows; i++) {
    if (grid[i] && lab[i] < 0) {
      let cnt = 0;
      st.length = 0;
      st.push(i);
      lab[i] = id;
      while (st.length) {
        const p = st.pop();
        if (p === undefined) break;
        cnt++;
        const px = p % cols;
        const py = (p / cols) | 0;
        for (const [a, b] of dirs) {
          const nx = px + a;
          const ny = py + b;
          if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) {
            const q = ny * cols + nx;
            if (grid[q] && lab[q] < 0) {
              lab[q] = id;
              st.push(q);
            }
          }
        }
      }
      sizes.push(cnt);
      id++;
    }
  }
  return { lab, sizes, count: id };
}

/**
 * @param {Uint8Array} grid
 * @param {number} minSize
 * @param {number} cols
 * @param {number} rows
 */
function removeSmall(grid, minSize, cols, rows) {
  const { lab, sizes } = components(grid, cols, rows, true);
  const o = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    if (grid[i] && sizes[lab[i]] >= minSize) o[i] = 1;
  }
  return o;
}

/**
 * @param {Uint8Array} mask
 * @param {number} cols
 * @param {number} rows
 */
function boundary(mask, cols, rows) {
  const o = new Uint8Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!mask[i]) continue;
      let edge = false;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + a;
        const ny = y + b;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !mask[ny * cols + nx]) {
          edge = true;
          break;
        }
      }
      if (edge) o[i] = 1;
    }
  }
  return o;
}

/**
 * @param {Uint8Array} mask
 * @param {number} cols
 * @param {number} rows
 */
function outline1(mask, cols, rows) {
  return removeSmall(boundary(mask, cols, rows), 2, cols, rows);
}

/**
 * @param {Uint8Array} mask
 * @param {number} cols
 * @param {number} rows
 */
function outline2(mask, cols, rows) {
  const o1 = boundary(mask, cols, rows);
  const inner = boundary(erode4(mask, cols, rows), cols, rows);
  const o2 = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) o2[i] = o1[i] || inner[i] ? 1 : 0;
  let c1 = 0;
  let c2 = 0;
  for (let i = 0; i < cols * rows; i++) {
    c1 += o1[i];
    c2 += o2[i];
  }
  if (c2 < c1 * 1.25) return { grid: o1, fellback: true };
  return { grid: removeSmall(o2, 2, cols, rows), fellback: false };
}

/**
 * @param {Uint8Array} mask
 * @param {number} cols
 * @param {number} rows
 */
function outline3(mask, cols, rows) {
  const o1 = boundary(mask, cols, rows);
  const eroded1 = erode4(mask, cols, rows);
  const ring1 = boundary(eroded1, cols, rows);
  const eroded2 = erode4(eroded1, cols, rows);
  const ring2 = boundary(eroded2, cols, rows);
  const o3 = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) o3[i] = o1[i] || ring1[i] || ring2[i] ? 1 : 0;
  let c1 = 0;
  let c3 = 0;
  for (let i = 0; i < cols * rows; i++) {
    c1 += o1[i];
    c3 += o3[i];
  }
  if (c3 < c1 * 1.5) return { grid: outline2(mask, cols, rows).grid, fellback: true };
  return { grid: removeSmall(o3, 2, cols, rows), fellback: false };
}

/**
 * @param {Uint8Array} mask
 * @param {number} mode
 * @param {number} cols
 * @param {number} rows
 */
function applyOutline(mask, mode, cols, rows) {
  if (mode === 1) return outline1(mask, cols, rows);
  if (mode === 2) return outline2(mask, cols, rows).grid;
  if (mode === 3) return outline3(mask, cols, rows).grid;
  return mask;
}

/**
 * @param {Uint8ClampedArray | Uint8Array | number[]} grayBuf
 * @param {Uint8ClampedArray | Uint8Array | number[]} alphaBuf
 * @param {number} cols
 * @param {number} rows
 * @param {Partial<ConversionState>} convState
 */
export function computeBaseMask(grayBuf, alphaBuf, cols, rows, convState) {
  validateShape(cols, rows);
  validateLength(grayBuf, cols * rows, 'grayBuf');
  validateLength(alphaBuf, cols * rows, 'alphaBuf');
  const n = cols * rows;
  const { method, threshold, invert } = normalizeConversionState(convState);
  if (method === 'alpha') return alphaMask(alphaBuf, invert, n);
  if (method === 'otsu') return fillT(grayBuf, otsu(grayBuf), invert, cols, rows);
  if (method === 'global') return fillT(grayBuf, threshold, invert, cols, rows);
  if (method === 'mean') return fillT(grayBuf, meanT(grayBuf), invert, cols, rows);
  if (method === 'sauvola') return sauvolaFill(grayBuf, 15, 0.2, invert, cols, rows);
  if (method === 'adaptive') return adaptiveFill(grayBuf, 9, 8, invert, cols, rows);
  return fillT(grayBuf, threshold, invert, cols, rows);
}

/**
 * @param {SourceImageState | null | undefined} sourceImageState
 * @param {Partial<ConversionState>} convState
 * @param {number} cols
 * @param {number} rows
 */
export function convertToDots(sourceImageState, convState, cols, rows) {
  validateShape(cols, rows);
  if (!sourceImageState) return new Uint8Array(cols * rows);
  const { grayBuf, alphaBuf } = sourceImageState;
  validateLength(grayBuf, cols * rows, 'grayBuf');
  validateLength(alphaBuf, cols * rows, 'alphaBuf');
  const state = normalizeConversionState(convState);

  let mask;
  if (state.edge === 'sobel') {
    mask = sobelEdge(grayBuf, cols, rows);
    if (state.invert) {
      for (let i = 0; i < mask.length; i++) mask[i] ^= 1;
    }
  } else {
    mask = computeBaseMask(grayBuf, alphaBuf, cols, rows, state);
  }

  if (state.dilate) mask = dilate4(mask, cols, rows);
  if (state.erode) mask = erode4(mask, cols, rows);
  if (state.denoise) mask = denoiseG(mask, cols, rows);

  const cleaned = removeSmall(mask, state.minComp ?? 2, cols, rows);
  return applyOutline(cleaned, state.outline ?? 0, cols, rows);
}

/**
 * @param {SourceImageState | null | undefined} sourceImageState
 * @param {number} cols
 * @param {number} rows
 * @returns {Partial<ConversionState>}
 */
export function autoSelectParams(sourceImageState, cols, rows) {
  validateShape(cols, rows);
  if (!sourceImageState) return {};
  const { grayBuf, alphaBuf } = sourceImageState;
  const meta = analyzeImageType(grayBuf, alphaBuf, cols, rows);
  const { type } = meta;
  /** @type {ConversionState['method']} */
  let method = 'global';
  let invert = false;
  /** @type {0} */
  const outline = 0;
  const threshold = otsu(grayBuf);

  if (meta.hasAlpha) {
    const onCnt = sumGrid(alphaMask(alphaBuf, false, cols * rows));
    invert = onCnt / (cols * rows) > 0.65;
    method = 'alpha';
  } else if (type === 'lineart') {
    method = 'otsu';
    const rawOn = sumGrid(fillT(grayBuf, threshold, false, cols, rows));
    if (rawOn / (cols * rows) > 0.6) invert = true;
  } else if (type === 'lowcontrast') {
    method = 'adaptive';
  } else {
    method = 'otsu';
    const rawOn = sumGrid(fillT(grayBuf, threshold, false, cols, rows));
    if (rawOn / (cols * rows) > 0.72) invert = true;
  }

  return { method, threshold, invert, outline, minComp: 2 };
}

/**
 * @param {SourceImageState | null | undefined} sourceImageState
 * @param {number} cols
 * @param {number} rows
 * @param {object} [opts]
 */
export function optimizeForDotPad(sourceImageState, cols, rows, opts = {}) {
  void opts;
  validateShape(cols, rows);
  if (!sourceImageState) return { params: {}, score: 0, grade: 1 };
  const { grayBuf, alphaBuf } = sourceImageState;
  const meta = analyzeImageType(grayBuf, alphaBuf, cols, rows);

  const base = autoSelectParams(sourceImageState, cols, rows);
  const ot = otsu(grayBuf);
  /** @type {Array<ConversionState['method']>} */
  const methods = meta.hasAlpha ? ['alpha'] : ['otsu', 'adaptive', 'global'];
  const thresholds = [ot - 30, ot - 15, ot, ot + 15, ot + 30]
    .map((v) => Math.max(20, Math.min(240, v)));
  /** @type {Array<0 | 1>} */
  const outlines = [0, 1];
  const denoises = [false, true];

  /** @type {{ params: ConversionState, score: number, grade: number } | null} */
  let best = null;
  /**
   * @param {Partial<ConversionState>} params
   */
  const evalParams = (params) => {
    const conv = normalizeConversionState({
      method: 'global',
      threshold: ot,
      invert: false,
      outline: 0,
      minComp: 2,
      dilate: false,
      erode: false,
      denoise: false,
      edge: 'none',
      ...params,
    });
    const grid = convertToDots(sourceImageState, conv, cols, rows);
    const on = sumGrid(grid);
    const dens = on / (cols * rows);
    if (dens < 0.02 || dens > 0.6) return;
    const q = tactileQualityScore(grid, cols, rows, { type: meta.type, outline: conv.outline });
    if (!best || q.score > best.score) best = { params: conv, score: q.score, grade: q.grade };
  };

  for (const method of methods) {
    if (method === 'global') {
      for (const threshold of thresholds) {
        for (const outline of outlines) {
          for (const denoise of denoises) {
            evalParams({ method, threshold, invert: Boolean(base.invert), outline, denoise });
          }
        }
      }
    } else {
      for (const outline of outlines) {
        for (const denoise of denoises) {
          evalParams({ method, invert: Boolean(base.invert), outline, denoise });
          evalParams({ method, invert: !base.invert, outline, denoise });
        }
      }
    }
  }

  if (!best) {
    const fallback = normalizeConversionState({ ...base, dilate: false, erode: false, denoise: false, edge: 'none' });
    const grid = convertToDots(sourceImageState, fallback, cols, rows);
    const q = tactileQualityScore(grid, cols, rows, { type: meta.type, outline: fallback.outline });
    best = { params: fallback, score: q.score, grade: q.grade };
  }
  return best;
}

/**
 * @param {Uint8Array} grid
 * @param {number} cols
 * @param {number} rows
 */
function metricsOf(grid, cols, rows) {
  let on = 0;
  let iso = 0;
  let ends = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!grid[i]) continue;
      on++;
      const k = nb(grid, x, y, cols, rows, true);
      if (k < 1) iso++;
      else if (k === 1) ends++;
    }
  }
  const { sizes } = components(grid, cols, rows, true);
  const count = sizes.length;
  const major = sizes.length ? Math.max(...sizes) : 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y * cols + x]) {
        sx += x;
        sy += y;
      }
    }
  }
  const cx = on ? sx / on : cols / 2;
  const cy = on ? sy / on : rows / 2;
  const centerOff = Math.hypot((cx - (cols - 1) / 2) / (cols / 2), (cy - (rows - 1) / 2) / (rows / 2));
  const density = on / (cols * rows);
  return { on, iso, ends, count, major, density, majorFrac: on ? major / on : 0, centerOff };
}

/**
 * @param {Uint8Array} grid
 * @param {number} cols
 * @param {number} rows
 * @param {{ type?: string, outline?: number }} [bias]
 */
export function tactileQualityScore(grid, cols, rows, bias = {}) {
  validateShape(cols, rows);
  validateLength(grid, cols * rows, 'grid');
  const m = metricsOf(grid, cols, rows);
  if (m.on < 8) return { score: 8, grade: 1, m };
  let s = 100;
  const dn = m.density;
  if (dn < 0.05) s -= 45;
  else if (dn < 0.08) s -= 18;
  else if (dn > 0.5) s -= 40;
  else if (dn > 0.42) s -= 16;
  s -= Math.min(30, (m.iso / m.on) * 120);
  s -= Math.min(18, (m.ends / m.on) * 55);
  s -= Math.min(22, Math.max(0, m.count - 3) * 3);
  s += Math.min(8, (m.majorFrac - 0.5) * 16);
  s -= Math.min(10, m.centerOff * 10);
  if (bias.type === 'lineart' && bias.outline === 0) s += 4;
  if (bias.type === 'photo' && bias.outline === 1) s += 3;
  s = Math.max(0, Math.min(100, s));
  let grade = 1;
  if (s >= 84) grade = 4;
  else if (s >= 68) grade = 3;
  else if (s >= 48) grade = 2;
  return { score: s, grade, m };
}

/**
 * @param {number} grade
 * @param {{ on: number, density: number, iso: number, count?: number } | undefined} metrics
 * @param {'ko' | 'en'} [lang]
 */
export function gradeReason(grade, metrics, lang = 'ko') {
  if (!metrics) return '';
  if (grade >= 3) {
    if (metrics.iso / Math.max(1, metrics.on) < 0.08 && (metrics.count ?? 0) <= 4) {
      return lang === 'ko' ? 'Outlines are connected and isolated dots are minimal.' : 'Outlines are connected and isolated dots are minimal.';
    }
    return lang === 'ko' ? 'Shape is clear and easy to distinguish by touch.' : 'Shape is clear and easy to distinguish by touch.';
  }
  if (metrics.density < 0.06) {
    return lang === 'ko' ? 'Too few pins. Try increasing density.' : 'Too few pins. Try increasing density.';
  }
  if (metrics.density > 0.45) {
    return lang === 'ko' ? 'Too dense. Try using 1-line outline.' : 'Too dense. Try using 1-line outline.';
  }
  if (metrics.iso / Math.max(1, metrics.on) > 0.18) {
    return lang === 'ko' ? 'Many isolated dots. Try denoising.' : 'Many isolated dots. Try denoising.';
  }
  return lang === 'ko' ? 'Simplifying the shape would help.' : 'Simplifying the shape would help.';
}

/**
 * @param {Uint8Array} grid
 * @param {number} cols
 * @param {number} rows
 */
export function analyzeDensity(grid, cols, rows) {
  validateShape(cols, rows);
  validateLength(grid, cols * rows, 'grid');
  const n = cols * rows;
  let on = 0;
  let crowded = 0;
  const mask = new Uint8Array(n);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!grid[i]) continue;
      on++;
      if (nb(grid, x, y, cols, rows, true) >= 7) {
        mask[i] = 1;
        crowded++;
      }
    }
  }
  const pct = Math.round((on / n) * 100);
  const crowdFrac = on ? crowded / on : 0;
  const level = pct >= 45 || crowdFrac > 0.4 ? 'high' : pct >= 30 || crowdFrac > 0.22 ? 'mid' : 'ok';
  return { pct, on, crowded, crowdFrac, level, mask };
}

/**
 * @param {Uint8Array} grid
 * @param {number} cols
 * @param {number} rows
 * @param {number} [maxIter]
 */
export function autoThinDots(grid, cols, rows, maxIter = 6) {
  validateShape(cols, rows);
  validateLength(grid, cols * rows, 'grid');
  let g = new Uint8Array(grid);
  for (let it = 0; it < maxIter; it++) {
    const d = analyzeDensity(g, cols, rows);
    if (d.level === 'ok' || d.crowded === 0) break;
    const next = new Uint8Array(g);
    let changed = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (g[i] && nb(g, x, y, cols, rows, true) === 8) {
          next[i] = 0;
          changed++;
        }
      }
    }
    if (!changed) break;
    g = next;
  }
  return g;
}

/**
 * @param {Uint8Array} grid
 */
function sumGrid(grid) {
  let sum = 0;
  for (let i = 0; i < grid.length; i++) sum += grid[i];
  return sum;
}

/**
 * @param {number} cols
 * @param {number} rows
 */
function validateShape(cols, rows) {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) {
    throw new RangeError('cols and rows must be positive integers');
  }
}

/**
 * @param {ArrayLike<unknown>} value
 * @param {number} expected
 * @param {string} label
 */
function validateLength(value, expected, label) {
  if (value.length !== expected) {
    throw new RangeError(`${label} length ${value.length} does not match ${expected}`);
  }
}
