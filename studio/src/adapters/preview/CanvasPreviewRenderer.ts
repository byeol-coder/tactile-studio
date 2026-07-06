import { RESOLUTION_DIMS, type TactileDocument } from '../../types/tactile';
import { docToFrame } from '../../model/frame';
import type { PreviewOptions, PreviewRenderer } from '../types';

/**
 * On-screen preview adapter: paints the model onto a 2D canvas context as a
 * dot matrix. Same model in, so what the user sees matches what the device and
 * embosser adapters encode. Used by the live canvas and PNG raster export.
 */
export class CanvasPreviewRenderer implements PreviewRenderer {
  readonly id = 'canvas-preview';

  draw(doc: TactileDocument, ctx: CanvasRenderingContext2D, opts: PreviewOptions = {}): void {
    const {
      cellPx = 12,
      showGrid = false,
      dotColor = '#1a1a1a',
      gridColor = 'rgba(0,0,0,0.08)',
      background = '#ffffff',
    } = opts;
    const { width, height } = RESOLUTION_DIMS[doc.resolution];
    const frame = docToFrame(doc);

    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width * cellPx, height * cellPx);
    }

    const rActive = cellPx * 0.38;
    const rGrid = cellPx * 0.12;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const active = frame.bitmap[y * width + x] !== 0;
        if (!active && !showGrid) continue;
        const px = x * cellPx + cellPx / 2;
        const py = y * cellPx + cellPx / 2;
        ctx.beginPath();
        ctx.arc(px, py, active ? rActive : rGrid, 0, Math.PI * 2);
        ctx.fillStyle = active ? dotColor : gridColor;
        ctx.fill();
      }
    }
  }
}

export const canvasPreviewRenderer = new CanvasPreviewRenderer();
