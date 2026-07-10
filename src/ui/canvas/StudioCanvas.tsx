// src/ui/canvas/StudioCanvas.tsx
//
// Verbatim-ported rendering (monolith drawMain) and pointer mapping
// (monolith evCell), wired to the Phase 5 EditorStore instead of
// this.state/this.cells. Preserves exact pixel math:
//   cellPx(): gridW<=28?20 : <=60?13 : <=84?7 : 9
//   active dot  #1E1C1A radius 0.36*c   inactive dot #E3D9CE radius 0.1*c
//   preview     rgba(196,61,0,0.85)     selection    #C43D00 dashed [5,4]
//   keyboard cursor stroke #C43D00 width 2
//
// PERFORMANCE: drag/preview state (the in-progress shape outline, the
// "last painted cell" for brush interpolation) lives in a local ref, NOT the
// store — so dragging a shape or painting a stroke redraws only this
// component's own canvas, on its own rAF loop, without notifying the store's
// other subscribers (toolbar, page panel, undo/redo buttons). The store only
// learns about the change once, via mutateActiveCells/endStroke, when the
// gesture completes. This is the "do not rerender the whole editor per pin
// update" requirement from the migration spec — the final pixels and undo
// entry are identical to a single monolith snapshot()+mutate+bump() call.
//
// DEFERRED (documented, not silently skipped): the 'poly' and 'text' tools
// are selectable but have no pointer-gesture wiring yet — poly needs
// multi-click point collection + Escape-to-cancel + a fill rasterizer this
// phase doesn't yet port, and text needs the textPopover UI. Tracked for a
// Phase 5 continuation alongside the toolbar/inspector/dialogs work.

import React, { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import { line, rectOutline, ellipseOutline, makeBrush, floodFill } from '../../core/geometry/raster.js';
import { cellIndex, inBounds } from '../../core/grid/grid.js';

function cellPx(gridW: number): number {
  return gridW <= 28 ? 20 : gridW <= 60 ? 13 : gridW <= 84 ? 7 : 9;
}

type DragState =
  | { mode: 'paint'; value: 0 | 1; size: number; lastX: number; lastY: number }
  | { mode: 'shape'; x0: number; y0: number; preview: Set<number> }
  | { mode: 'sel'; x0: number; y0: number }
  | null;

export interface StudioCanvasProps {
  /** ARIA label for the canvas (host-supplied, since Studio owns no i18n). */
  ariaLabel?: string;
}

export function StudioCanvas({ ariaLabel }: StudioCanvasProps) {
  const { snapshot, store } = useEditorStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const rafRef = useRef<number | null>(null);

  const c = cellPx(snapshot.gridW);
  const { gridW, gridH } = snapshot;

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    if (cv.width !== gridW * c) cv.width = gridW * c;
    if (cv.height !== gridH * c) cv.height = gridH * c;
    const g = cv.getContext('2d');
    if (!g) return; // no 2D context available (e.g. jsdom in tests) — draw() is a no-op, not an error
    const cells = store.getActiveCells();

    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < gridH; y++) for (let x = 0; x < gridW; x++) {
      const i = y * gridW + x, px = x * c + c / 2, py = y * c + c / 2;
      if (cells[i]) {
        g.fillStyle = '#1E1C1A';
        g.beginPath(); g.arc(px, py, c * 0.36, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = '#E3D9CE';
        g.beginPath(); g.arc(px, py, Math.max(1, c * 0.1), 0, Math.PI * 2); g.fill();
      }
    }

    const drag = dragRef.current;
    if (drag && drag.mode === 'shape') {
      g.fillStyle = 'rgba(196,61,0,0.85)';
      drag.preview.forEach((i) => {
        const x = i % gridW, y = (i / gridW) | 0;
        g.beginPath(); g.arc(x * c + c / 2, y * c + c / 2, c * 0.36, 0, Math.PI * 2); g.fill();
      });
    }

    const sel = snapshot.selRect;
    if (sel) {
      g.strokeStyle = '#C43D00'; g.lineWidth = 1.5; g.setLineDash([5, 4]);
      g.strokeRect(sel.x0 * c + 0.5, sel.y0 * c + 0.5, (sel.x1 - sel.x0 + 1) * c - 1, (sel.y1 - sel.y0 + 1) * c - 1);
      g.setLineDash([]);
    }

    if (snapshot.tool === 'cursor') {
      g.strokeStyle = '#C43D00'; g.lineWidth = 2;
      g.strokeRect(snapshot.cursor.cx * c + 1, snapshot.cursor.cy * c + 1, c - 2, c - 2);
    }
  }, [gridW, gridH, c, snapshot.selRect, snapshot.tool, snapshot.cursor, store]);

  // Redraw on every store-visible change (low-frequency: tool switch, page
  // switch, selection change, undo/redo, stroke-end). Mid-drag redraws are
  // scheduled directly from the pointer handlers below via requestAnimationFrame,
  // bypassing this effect entirely.
  useEffect(() => { draw(); }, [draw, snapshot.rev, snapshot.pageIndex]);

  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  const scheduleDragRedraw = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; draw(); });
  }, [draw]);

  const evCell = useCallback((e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) * (cv.width / r.width)) / c);
    const y = Math.floor(((e.clientY - r.top) * (cv.height / r.height)) / c);
    return [Math.max(0, Math.min(gridW - 1, x)), Math.max(0, Math.min(gridH - 1, y))];
  }, [c, gridW, gridH]);

  const strokeSizeFor = (tool: string) => (tool === 'eraser' ? snapshot.eraserSize : snapshot.strokeSize);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    canvasRef.current?.focus();
    const [x, y] = evCell(e);
    const tool = snapshot.tool;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* capture is an optimization, never fatal */ }

    if (tool === 'cursor') { store.setCursor(x, y); return; }

    if (tool === 'pen' || tool === 'eraser') {
      const value: 0 | 1 = tool === 'pen' ? 1 : 0;
      const size = strokeSizeFor(tool);
      store.beginStroke();
      const plot = makeBrush((px, py) => { if (inBounds(gridW, gridH, px, py)) store.getActiveCells()[cellIndex(gridW, px, py)] = value; }, size);
      store.paintDuring(() => plot(x, y));
      dragRef.current = { mode: 'paint', value, size, lastX: x, lastY: y };
      store.setCursor(x, y);
      scheduleDragRedraw();
      return;
    }

    if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      dragRef.current = { mode: 'shape', x0: x, y0: y, preview: new Set([cellIndex(gridW, x, y)]) };
      store.setCursor(x, y);
      scheduleDragRedraw();
      return;
    }

    if (tool === 'fill') {
      store.mutateActiveCells((cells) => floodFill(cells, gridW, gridH, x, y));
      store.setCursor(x, y);
      return;
    }

    if (tool === 'select') {
      dragRef.current = { mode: 'sel', x0: x, y0: y };
      store.setSelRect({ x0: x, y0: y, x1: x, y1: y });
      store.setCursor(x, y);
      return;
    }
    // 'poly' / 'text': deferred, see file header — tool is selectable but
    // pointerdown here is intentionally a no-op until that sub-step lands.
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [x, y] = evCell(e);
    const drag = dragRef.current;
    if (!drag) {
      if (x !== snapshot.cursor.cx || y !== snapshot.cursor.cy) store.setCursor(x, y);
      return;
    }
    if (drag.mode === 'paint') {
      const plot = makeBrush((px, py) => { if (inBounds(gridW, gridH, px, py)) store.getActiveCells()[cellIndex(gridW, px, py)] = drag.value; }, drag.size);
      store.paintDuring(() => line(drag.lastX, drag.lastY, x, y, plot));
      drag.lastX = x; drag.lastY = y;
      scheduleDragRedraw();
    } else if (drag.mode === 'shape') {
      const s = new Set<number>();
      const add = makeBrush((px, py) => { if (inBounds(gridW, gridH, px, py)) s.add(cellIndex(gridW, px, py)); }, strokeSizeFor(snapshot.tool));
      if (snapshot.tool === 'line') line(drag.x0, drag.y0, x, y, add);
      else if (snapshot.tool === 'rect') rectOutline(drag.x0, drag.y0, x, y, add);
      else ellipseOutline(drag.x0, drag.y0, x, y, add);
      drag.preview = s;
      scheduleDragRedraw();
    } else if (drag.mode === 'sel') {
      store.setSelRect({ x0: Math.min(drag.x0, x), y0: Math.min(drag.y0, y), x1: Math.max(drag.x0, x), y1: Math.max(drag.y0, y) });
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.mode === 'paint') {
      store.endStroke();
    } else if (drag.mode === 'shape') {
      const preview = drag.preview;
      store.mutateActiveCells((cells) => { preview.forEach((i) => { cells[i] = 1; }); });
    }
    // 'sel' needs no commit — setSelRect was already called live during the drag.
  };

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ display: 'block', outline: 'none', touchAction: 'none', imageRendering: 'pixelated' }}
    />
  );
}
