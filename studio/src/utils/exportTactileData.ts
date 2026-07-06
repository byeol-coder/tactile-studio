import { RESOLUTION_DIMS, type TactileDocument } from '../types/tactile';
import { buildDtmsContainer } from '../adapters/dotpad/DotPadAdapter';
import { canvasPreviewRenderer } from '../adapters/preview/CanvasPreviewRenderer';
import { embossAdapter } from '../adapters/emboss/EmbossAdapter';
import type { FileExport } from '../adapters/types';

/**
 * Thin browser-download shims over the adapter layer.
 *
 * All encoding lives in the device-agnostic adapters (see src/adapters/*); this
 * module only turns their output into a downloaded file. Existing call sites
 * keep their signatures.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function download(file: FileExport): void {
  triggerDownload(file.blob, file.filename);
}

function safeName(doc: TactileDocument): string {
  return (doc.title || 'tactile').replace(/[^\w.-]+/g, '_');
}

/** Developer-facing JSON export of the full document. */
export function exportJson(doc: TactileDocument): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${safeName(doc)}.json`);
}

/**
 * DTMS export — real `.dtms` container (JSON) via the DotPad adapter, so files
 * round-trip through the existing parser and load on hardware.
 */
export function exportDtms(doc: TactileDocument): void {
  const blob = new Blob([buildDtmsContainer(doc)], { type: 'application/json' });
  triggerDownload(blob, `${safeName(doc)}.dtms`);
}

/** SVG export for embossers / swell paper via the emboss adapter. */
export function exportSvg(doc: TactileDocument): void {
  download(embossAdapter.export(doc, 'svg'));
}

/** Rasterise the grid to a PNG via the shared preview renderer and download it. */
export function exportPng(doc: TactileDocument, cellPx = 12): void {
  const { width, height } = RESOLUTION_DIMS[doc.resolution];
  const canvas = document.createElement('canvas');
  canvas.width = width * cellPx;
  canvas.height = height * cellPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvasPreviewRenderer.draw(doc, ctx, { cellPx });

  canvas.toBlob((blob) => {
    if (blob) triggerDownload(blob, `${safeName(doc)}.png`);
  }, 'image/png');
}
