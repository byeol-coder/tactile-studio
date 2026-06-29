// ── Export Utilities ──────────────────────────────────────────

import { buildDtmsJSON, gridToHex } from './engine.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  requestAnimationFrame(() => { document.body.removeChild(a); URL.revokeObjectURL(url); });
}

/**
 * Export all pages as a .dtms file.
 */
export function exportDtms(pages, fileName, cols, rows) {
  const json = buildDtmsJSON(pages, fileName, cols, rows);
  download(new Blob([json], { type: 'application/json' }), (fileName || 'untitled') + '.dtms');
}

/**
 * Export the dot pattern as a transparent PNG.
 * Renders ONLY raised (ON) pins as solid dots on a fully transparent
 * background — no canvas fill, grid lines, axes, or OFF dots.
 *
 * @param {Uint8Array} data - pin data (ON = truthy)
 * @param {number} cols
 * @param {number} rows
 * @param {string} fileName
 * @param {object} [opts] - { cell, color, pad }
 */
export function exportPng(data, cols, rows, fileName, opts = {}) {
  const cell  = opts.cell  ?? 16;            // px per pin (export resolution, zoom-independent)
  const color = opts.color ?? '#1C1C1E';     // dot color, matches on-screen DOT_ON
  const pad   = opts.pad   ?? cell;          // transparent margin around the pattern (1 pin by default)
  const dotR  = cell * 0.40;                 // matches on-screen rOn ratio

  const cv = document.createElement('canvas');
  cv.width  = cols * cell + pad * 2;
  cv.height = rows * cell + pad * 2;
  const ctx = cv.getContext('2d');
  // background left transparent on purpose — do NOT fillRect.

  ctx.fillStyle = color;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!data[y * cols + x]) continue;     // only ON pins
      const cx = pad + x * cell + cell / 2;
      const cy = pad + y * cell + cell / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  cv.toBlob(blob => {
    if (blob) download(blob, (fileName || 'tactile') + '.png');
  }, 'image/png');
}

/**
 * Export current canvas data as JSON (debug / dev).
 */
export function exportJson(canvasData, pages, fileName, cols, rows) {
  const obj = {
    fileName,
    resolution: { cols, rows },
    pages: pages.map((p, i) => ({
      index: i,
      title: p.title,
      hex: gridToHex(p.canvasData, cols, rows),
      altText: p.altText,
    })),
  };
  download(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), (fileName || 'export') + '.json');
}

/**
 * Copy current page hex to clipboard.
 */
export async function copyHexToClipboard(canvasData, cols, rows) {
  const hex = gridToHex(canvasData, cols, rows);
  await navigator.clipboard.writeText(hex);
  return hex;
}

/**
 * Parse a .dtms file (JSON) and return { fileName, pages[] }.
 */
export function parseDtms(text) {
  const obj = JSON.parse(text);
  const pages = (obj.items || []).map(item => ({
    title: item.title || 'Page',
    hex: item.graphic?.data || '',
    altText: item.text?.plain || '',
  }));
  return { fileName: obj.title || 'Untitled', pages };
}
