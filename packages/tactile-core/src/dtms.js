import { KNOWN_RESOLUTIONS, assertResolution, normalizePinGrid } from '@dot/tactile-contract';

/**
 * @typedef {import('@dot/tactile-contract').DtmsPage} DtmsPage
 * @typedef {import('@dot/tactile-contract').TactileResolution} TactileResolution
 */

export const KNOWN_DTMS_RESOLUTIONS = KNOWN_RESOLUTIONS;

/**
 * DotPad/Dot Fossil 2x4 cell bit layout:
 * bit0..3 = left column top-to-bottom, bit4..7 = right column top-to-bottom.
 *
 * @param {number} localX
 * @param {number} localY
 */
export function dotBit(localX, localY) {
  if ((localX !== 0 && localX !== 1) || localY < 0 || localY > 3 || !Number.isInteger(localY)) {
    throw new RangeError('dotBit expects localX 0..1 and localY 0..3');
  }
  return localX * 4 + localY;
}

/**
 * @param {TactileResolution} resolution
 */
export function hexLengthForResolution(resolution) {
  const { cols, rows } = assertResolution(resolution);
  return (cols / 2) * (rows / 4) * 2;
}

/**
 * @param {number} hexLen
 * @returns {TactileResolution | null}
 */
export function inferResolutionFromHexLength(hexLen) {
  for (const resolution of KNOWN_DTMS_RESOLUTIONS) {
    if (hexLen === hexLengthForResolution(resolution)) return resolution;
  }
  return null;
}

/**
 * @param {ArrayLike<unknown>} data
 * @param {number} cols
 * @param {number} rows
 */
export function gridToHex(data, cols, rows) {
  const resolution = assertResolution({ cols, rows });
  const grid = normalizePinGrid(data, resolution);
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
          if (grid[y * cols + x]) b |= 1 << dotBit(lx, ly);
        }
      }
      hex += b.toString(16).padStart(2, '0').toUpperCase();
    }
  }
  return hex;
}

/**
 * @param {string} hex
 * @param {number} cols
 * @param {number} rows
 */
export function hexToGrid(hex, cols, rows) {
  assertResolution({ cols, rows });
  const clean = normalizeHex(hex);
  const cc = (cols / 2) | 0;
  const cr = (rows / 4) | 0;
  const data = new Uint8Array(cols * rows);
  let idx = 0;
  for (let r = 0; r < cr; r++) {
    for (let c = 0; c < cc; c++) {
      const b = parseInt(clean.slice(idx * 2, idx * 2 + 2), 16) || 0;
      idx++;
      for (let lx = 0; lx < 2; lx++) {
        for (let ly = 0; ly < 4; ly++) {
          if ((b >> dotBit(lx, ly)) & 1) {
            const x = c * 2 + lx;
            const y = r * 4 + ly;
            data[y * cols + x] = 1;
          }
        }
      }
    }
  }
  return data;
}

/**
 * Match the browser engine's DTMS bundle shape from js/engine.js.
 *
 * @param {DtmsPage[]} pages
 * @param {string} fileName
 * @param {number} cols
 * @param {number} rows
 */
export function buildDtmsJSON(pages, fileName, cols, rows) {
  assertResolution({ cols, rows });
  const name = (fileName || 'Untitled').trim();
  const items = pages.map((page, i) => {
    const hex = page.hex ?? gridToHex(page.canvasData ?? new Uint8Array(cols * rows), cols, rows);
    return {
      page: i + 1,
      title: name + (pages.length > 1 ? ` ${i + 1}` : ''),
      graphic: { name: `${i + 1}.dtm`, data: normalizeHex(hex) },
      text: { name: `${i + 1}.txt`, data: page.altText || '', plain: name },
      audio: { fileName: '' },
    };
  });
  return JSON.stringify({
    title: name,
    lang: 'korean',
    lang_option: '1',
    device: 'dotpad320',
    audioPath: '',
    items,
  }, null, 2);
}

/**
 * @param {DtmsPage[]} pages
 * @param {string} fileName
 * @param {number} cols
 * @param {number} rows
 */
export function stringifyDtms(pages, fileName, cols, rows) {
  return buildDtmsJSON(pages, fileName, cols, rows);
}

/**
 * Parse a .dtms bundle, .dtm JSON file, wrapped hex JSON, or raw HEX payload.
 *
 * @param {string} text
 * @returns {{ fileName: string, pages: Array<{ title: string, hex: string, altText: string }>, cols: number | null, rows: number | null }}
 */
export function parseDtms(text) {
  const trimmed = text.trim();

  if (/^[0-9a-fA-F\s]+$/.test(trimmed) && trimmed.length >= 2) {
    const hex = normalizeHex(trimmed);
    const res = inferResolutionFromHexLength(hex.length);
    return {
      fileName: 'Untitled',
      pages: [{ title: 'Page', hex, altText: '' }],
      cols: res?.cols ?? null,
      rows: res?.rows ?? null,
    };
  }

  const obj = /** @type {any} */ (JSON.parse(trimmed));

  if (Array.isArray(obj.items)) {
    let cols = numberOrNull(obj.resolution?.cols);
    let rows = numberOrNull(obj.resolution?.rows);
    const pages = obj.items.map(/** @param {any} item */ (item) => ({
      title: String(item.title || 'Page'),
      hex: normalizeHex(item.graphic?.data || ''),
      altText: String(item.text?.plain || item.text?.data || ''),
    }));
    if (!cols || !rows) {
      const res = pages[0] && inferResolutionFromHexLength((pages[0].hex || '').length);
      if (res) {
        cols = res.cols;
        rows = res.rows;
      }
    }
    return { fileName: String(obj.title || 'Untitled'), pages, cols, rows };
  }

  if (obj.graphic?.data) {
    const res = obj.resolution?.cols
      ? { cols: Number(obj.resolution.cols), rows: Number(obj.resolution.rows) }
      : inferResolutionFromHexLength(String(obj.graphic.data).length);
    return {
      fileName: String(obj.title || 'Untitled'),
      pages: [{ title: String(obj.title || 'Page'), hex: normalizeHex(obj.graphic.data), altText: String(obj.text?.plain || '') }],
      cols: res?.cols ?? null,
      rows: res?.rows ?? null,
    };
  }

  const hex = obj.data || obj.hex || '';
  if (hex) {
    const clean = normalizeHex(hex);
    const res = inferResolutionFromHexLength(clean.length);
    return {
      fileName: String(obj.title || 'Untitled'),
      pages: [{ title: String(obj.title || 'Page'), hex: clean, altText: '' }],
      cols: res?.cols ?? null,
      rows: res?.rows ?? null,
    };
  }

  throw new Error('Unrecognized file format');
}

/**
 * @param {unknown} value
 */
export function normalizeHex(value) {
  const hex = String(value).replace(/\s/g, '').toUpperCase();
  if (hex && !/^[0-9A-F]+$/.test(hex)) {
    throw new Error('HEX payload contains non-hex characters');
  }
  return hex;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
