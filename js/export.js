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
 * Export pin grid as PNG with transparent background.
 * Only "on" pins (value 1) are drawn as solid dots; the canvas background
 * is left transparent so the file contains dot pattern only.
 *
 * @param {Uint8Array} gridData
 * @param {number} cols
 * @param {number} rows
 * @param {string} fileName
 * @param {number} [dotSize=10]  pixels per grid cell
 */
export function exportPng(gridData, cols, rows, fileName, dotSize = 10) {
  const offscreen = document.createElement('canvas');
  offscreen.width  = cols * dotSize;
  offscreen.height = rows * dotSize;
  const ctx = offscreen.getContext('2d');
  // no fill → transparent background
  ctx.fillStyle = '#1C1C1E';
  const r = Math.max(1, dotSize * 0.38);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (gridData[row * cols + col]) {
        ctx.beginPath();
        ctx.arc(
          col * dotSize + dotSize / 2,
          row * dotSize + dotSize / 2,
          r, 0, Math.PI * 2
        );
        ctx.fill();
      }
    }
  }
  offscreen.toBlob(blob => {
    if (blob) download(blob, (fileName || 'tactile') + '.png');
  });
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
