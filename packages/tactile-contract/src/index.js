/**
 * @typedef {'dotpad320' | 'dotpad320x' | 'dotpad-legacy-28x40' | 'custom'} TactileDevice
 */

/**
 * @typedef {object} TactileResolution
 * @property {number} cols
 * @property {number} rows
 * @property {TactileDevice} [device]
 */

/**
 * @typedef {Uint8Array} PinGrid
 */

/**
 * @typedef {'alpha' | 'otsu' | 'global' | 'mean' | 'sauvola' | 'adaptive'} ThresholdMethod
 */

/**
 * @typedef {'none' | 'sobel'} EdgeMode
 */

/**
 * @typedef {object} ConversionState
 * @property {ThresholdMethod} method
 * @property {number} threshold
 * @property {boolean} invert
 * @property {0 | 1 | 2 | 3} outline
 * @property {number} minComp
 * @property {boolean} [dilate]
 * @property {boolean} [erode]
 * @property {boolean} [denoise]
 * @property {EdgeMode} [edge]
 */

/**
 * @typedef {object} SourceImageState
 * @property {Uint8ClampedArray} grayBuf
 * @property {Uint8ClampedArray} alphaBuf
 */

/**
 * @typedef {object} DtmsPage
 * @property {string} [title]
 * @property {Uint8Array} [canvasData]
 * @property {string} [hex]
 * @property {string} [altText]
 */

export const DOTPAD_320 = Object.freeze({
  cols: 60,
  rows: 40,
  device: 'dotpad320',
});

export const DOTPAD_320X = Object.freeze({
  cols: 96,
  rows: 64,
  device: 'dotpad320x',
});

export const DOTPAD_LEGACY_28X40 = Object.freeze({
  cols: 28,
  rows: 40,
  device: 'dotpad-legacy-28x40',
});

export const KNOWN_RESOLUTIONS = Object.freeze([
  DOTPAD_LEGACY_28X40,
  DOTPAD_320,
  DOTPAD_320X,
]);

export const DEFAULT_CONVERSION_STATE = Object.freeze({
  method: 'global',
  threshold: 128,
  invert: false,
  outline: 0,
  minComp: 2,
  dilate: false,
  erode: false,
  denoise: false,
  edge: 'none',
});

/**
 * @param {number} cols
 * @param {number} rows
 * @param {TactileDevice} [device]
 * @returns {TactileResolution}
 */
export function makeResolution(cols, rows, device = 'custom') {
  return assertResolution({ cols, rows, device });
}

/**
 * @param {unknown} value
 * @returns {TactileResolution}
 */
export function assertResolution(value) {
  if (!value || typeof value !== 'object') {
    throw new TypeError('resolution must be an object');
  }
  const resolution = /** @type {{ cols?: unknown, rows?: unknown, device?: unknown }} */ (value);
  const cols = Number(resolution.cols);
  const rows = Number(resolution.rows);
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) {
    throw new RangeError('resolution cols and rows must be positive integers');
  }
  if (cols % 2 !== 0) {
    throw new RangeError('resolution cols must be divisible by 2 for DTMS cells');
  }
  if (rows % 4 !== 0) {
    throw new RangeError('resolution rows must be divisible by 4 for DTMS cells');
  }
  return {
    cols,
    rows,
    device: isTactileDevice(resolution.device) ? resolution.device : 'custom',
  };
}

/**
 * @param {unknown} value
 * @returns {value is TactileDevice}
 */
export function isTactileDevice(value) {
  return value === 'dotpad320'
    || value === 'dotpad320x'
    || value === 'dotpad-legacy-28x40'
    || value === 'custom';
}

/**
 * @param {TactileResolution} resolution
 * @returns {number}
 */
export function gridSize(resolution) {
  const { cols, rows } = assertResolution(resolution);
  return cols * rows;
}

/**
 * @param {TactileResolution} resolution
 * @returns {Uint8Array}
 */
export function createBlankGrid(resolution) {
  return new Uint8Array(gridSize(resolution));
}

/**
 * @param {unknown} value
 * @returns {0 | 1}
 */
export function coercePin(value) {
  return value ? 1 : 0;
}

/**
 * @param {ArrayLike<unknown>} data
 * @param {TactileResolution} resolution
 * @returns {Uint8Array}
 */
export function normalizePinGrid(data, resolution) {
  const expected = gridSize(resolution);
  if (data.length !== expected) {
    throw new RangeError(`pin grid length ${data.length} does not match resolution size ${expected}`);
  }
  const out = new Uint8Array(expected);
  for (let i = 0; i < expected; i++) out[i] = coercePin(data[i]);
  return out;
}

/**
 * @param {unknown} value
 * @param {TactileResolution} resolution
 * @param {string} [label]
 * @returns {Uint8Array}
 */
export function assertPinGrid(value, resolution, label = 'pin grid') {
  const expected = gridSize(resolution);
  if (!(value instanceof Uint8Array)) {
    throw new TypeError(`${label} must be a Uint8Array`);
  }
  if (value.length !== expected) {
    throw new RangeError(`${label} length ${value.length} does not match resolution size ${expected}`);
  }
  return value;
}

/**
 * @param {ArrayLike<unknown>} data
 * @returns {number}
 */
export function countRaisedPins(data) {
  let count = 0;
  for (let i = 0; i < data.length; i++) if (data[i]) count++;
  return count;
}

/**
 * @param {Uint8Array} grid
 * @returns {Uint8Array}
 */
export function clonePinGrid(grid) {
  return new Uint8Array(grid);
}

/**
 * @param {Partial<ConversionState>} [state]
 * @returns {ConversionState}
 */
export function normalizeConversionState(state = {}) {
  const merged = { ...DEFAULT_CONVERSION_STATE, ...state };
  return {
    method: normalizeMethod(merged.method),
    threshold: clampNumber(merged.threshold, 0, 255),
    invert: Boolean(merged.invert),
    outline: normalizeOutline(merged.outline),
    minComp: Math.max(0, Math.floor(Number(merged.minComp) || 0)),
    dilate: Boolean(merged.dilate),
    erode: Boolean(merged.erode),
    denoise: Boolean(merged.denoise),
    edge: merged.edge === 'sobel' ? 'sobel' : 'none',
  };
}

/**
 * @param {unknown} value
 * @returns {ThresholdMethod}
 */
function normalizeMethod(value) {
  if (value === 'alpha' || value === 'otsu' || value === 'global' || value === 'mean' || value === 'sauvola' || value === 'adaptive') {
    return value;
  }
  return 'global';
}

/**
 * @param {unknown} value
 * @returns {0 | 1 | 2 | 3}
 */
function normalizeOutline(value) {
  if (value === 1 || value === 2 || value === 3) return value;
  return 0;
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
