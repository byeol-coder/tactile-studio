// src/ui/panels/PageThumbnail.tsx
//
// A small, real (not placeholder) rendering of a page's cells, using the
// same dot-rendering convention as StudioCanvas.draw() at a much smaller
// scale. Like StudioCanvas, this no-ops under jsdom (getContext('2d')
// returns null in tests) — tests verify sizing/wiring, not pixels, same
// documented limitation as the main canvas.

import React, { useEffect, useRef } from 'react';
import type { CellGrid } from '../../core/types.js';

export interface PageThumbnailProps {
  cells: CellGrid;
  gridW: number;
  gridH: number;
  /** pixels per cell — kept tiny on purpose; default fits a 60-wide page in ~60px */
  cellPx?: number;
}

export function PageThumbnail({ cells, gridW, gridH, cellPx = 1 }: PageThumbnailProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const w = gridW * cellPx, h = gridH * cellPx;
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    const g = cv.getContext('2d');
    if (!g) return;
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1E1C1A';
    for (let y = 0; y < gridH; y++) for (let x = 0; x < gridW; x++) {
      if (cells[y * gridW + x]) g.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
    }
  }, [cells, gridW, gridH, cellPx]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ display: 'block', width: gridW * cellPx, height: gridH * cellPx, border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 4, imageRendering: 'pixelated' }}
    />
  );
}
