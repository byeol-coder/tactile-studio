// src/ui/canvas/StudioCanvas.tsx
//
// Verbatim-ported rendering (monolith drawMain) and pointer mapping
// (monolith evCell), wired to the Phase 5 EditorStore instead of
// this.state/this.cells. Preserves exact pixel math:
//   cellPx(): gridW<=28?20 : <=60?13 : <=84?7 : 9
//   active dot  #1E1C1A radius 0.36*c   inactive dot #E3D9CE radius 0.1*c
//   preview     rgba(196,61,0,0.85)     selection    #C43D00 dashed [5,4]
//   keyboard cursor stroke #C43D00 width 2     poly points  #C43D00 r=0.3*c
//
// PERFORMANCE: drag/preview state (in-progress shape outline, brush
// interpolation, in-progress poly points) lives in local refs, NOT the store
// — dragging/clicking redraws only this component's own canvas, on its own
// rAF loop, without notifying the store's other subscribers. The store only
// learns about the change once, via mutateActiveCells/endStroke, when the
// gesture completes.
//
// 'poly': verbatim port of updatePolyPreview()/closePoly() — click adds a
// point, Enter or double-click closes the loop (line-per-edge, brushed),
// Escape cancels. 'text': click opens a minimal inline popover; Enter
// commits via codecs/tactile-text's stampTextLayout with a REAL browser
// canvas glyph rasterizer (browser-glyph-rasterizer.ts) — injectable via
// props for tests, since jsdom has no real 2D canvas (documented, see
// docs/known-issues.md #5 and #2).

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import { line, rectOutline, ellipseOutline, makeBrush, floodFill } from '../../core/geometry/raster.js';
import { cellIndex, inBounds } from '../../core/grid/grid.js';
import { stampTextLayout, type GlyphRasterizer } from '../../codecs/tactile-text/tactile-text.js';
import { browserGlyphRasterizer } from './browser-glyph-rasterizer.js';

function cellPx(gridW: number): number {
  return gridW <= 28 ? 20 : gridW <= 60 ? 13 : gridW <= 84 ? 7 : 9;
}

type DragState =
  | { mode: 'paint'; value: 0 | 1; size: number; lastX: number; lastY: number; pointerId: number }
  | { mode: 'shape'; x0: number; y0: number; preview: Set<number>; pointerId: number }
  | { mode: 'sel'; x0: number; y0: number; pointerId: number }
  | null;

export interface StudioCanvasProps {
  /** ARIA label for the canvas (host-supplied, since Studio owns no i18n). */
  ariaLabel?: string;
  /** Overrides the real canvas-based glyph rasterizer — for tests only. */
  glyphRasterizer?: GlyphRasterizer;
}

export function StudioCanvas({ ariaLabel, glyphRasterizer = browserGlyphRasterizer }: StudioCanvasProps) {
  const { snapshot, store } = useEditorStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const rafRef = useRef<number | null>(null);
  const polyRef = useRef<{ points: Array<[number, number]>; preview: Set<number> }>({ points: [], preview: new Set() });
  const [textPopover, setTextPopover] = useState<{ gx: number; gy: number; left: number; top: number; value: string } | null>(null);

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

    if (polyRef.current.preview.size) {
      g.fillStyle = 'rgba(196,61,0,0.85)';
      polyRef.current.preview.forEach((i) => {
        const x = i % gridW, y = (i / gridW) | 0;
        g.beginPath(); g.arc(x * c + c / 2, y * c + c / 2, c * 0.36, 0, Math.PI * 2); g.fill();
      });
    }
    if (polyRef.current.points.length) {
      g.fillStyle = '#C43D00';
      polyRef.current.points.forEach(([x, y]) => {
        g.beginPath(); g.arc(x * c + c / 2, y * c + c / 2, c * 0.3, 0, Math.PI * 2); g.fill();
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

  // Page-switch drag/poly guard: a drag or in-progress polygon belongs to
  // the PAGE it started on, keyed by canvas-local refs (not store state) —
  // switching pages must not let it bleed into the new page's canvas.
  // Vanilla added this alongside the pointerId guards above (29ef81f);
  // ported together since both close the same class of gap (stale gesture
  // state surviving a transition it shouldn't survive).
  useEffect(() => {
    dragRef.current = null;
    polyRef.current = { points: [], preview: new Set() };
  }, [snapshot.pageIndex]);

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

  // ── poly: verbatim port of updatePolyPreview()/closePoly() ────────────────
  const updatePolyPreview = useCallback(() => {
    const s = new Set<number>();
    const base = (px: number, py: number) => { if (inBounds(gridW, gridH, px, py)) s.add(cellIndex(gridW, px, py)); };
    const add = makeBrush(base, snapshot.strokeSize);
    const pts = polyRef.current.points;
    for (let i = 0; i + 1 < pts.length; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], add);
    pts.forEach(([x, y]) => add(x, y));
    polyRef.current.preview = s;
    scheduleDragRedraw();
  }, [gridW, gridH, snapshot.strokeSize, scheduleDragRedraw]);

  const closePoly = useCallback(() => {
    const pts = polyRef.current.points;
    if (pts.length < 2) { polyRef.current = { points: [], preview: new Set() }; scheduleDragRedraw(); return; }
    store.mutateActiveCells((cells) => {
      const base = (px: number, py: number) => { if (inBounds(gridW, gridH, px, py)) cells[cellIndex(gridW, px, py)] = 1; };
      const add = makeBrush(base, snapshot.strokeSize);
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        line(x0, y0, x1, y1, add);
      }
    });
    polyRef.current = { points: [], preview: new Set() };
  }, [gridW, snapshot.strokeSize, store]);

  const cancelPoly = useCallback(() => {
    polyRef.current = { points: [], preview: new Set() };
    scheduleDragRedraw();
  }, [scheduleDragRedraw]);

  useEffect(() => {
    if (snapshot.tool !== 'poly') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && polyRef.current.points.length) { e.preventDefault(); closePoly(); }
      else if (e.key === 'Escape' && polyRef.current.points.length) { e.preventDefault(); cancelPoly(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [snapshot.tool, closePoly, cancelPoly]);

  // ── text: minimal inline popover, commits via stampTextLayout ─────────────
  const commitText = useCallback(() => {
    if (!textPopover) return;
    const value = textPopover.value;
    setTextPopover(null);
    if (!value.trim()) return;
    store.mutateActiveCells((cells) => {
      stampTextLayout(cells, gridW, gridH, value, textPopover.gx, textPopover.gy, {}, glyphRasterizer);
    });
  }, [textPopover, gridW, gridH, store, glyphRasterizer]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    // A second pointer touching down while a drag is already in progress
    // (classic case: a resting palm while drawing with a stylus, or an
    // accidental second finger) must not hijack/reset it — ignore until the
    // active pointer lifts (onPointerUp clears dragRef).
    if (dragRef.current && e.pointerId !== dragRef.current.pointerId) return;
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
      dragRef.current = { mode: 'paint', value, size, lastX: x, lastY: y, pointerId: e.pointerId };
      store.setCursor(x, y);
      scheduleDragRedraw();
      return;
    }

    if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      dragRef.current = { mode: 'shape', x0: x, y0: y, preview: new Set([cellIndex(gridW, x, y)]), pointerId: e.pointerId };
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
      dragRef.current = { mode: 'sel', x0: x, y0: y, pointerId: e.pointerId };
      store.setSelRect({ x0: x, y0: y, x1: x, y1: y });
      store.setCursor(x, y);
      return;
    }

    if (tool === 'poly') {
      polyRef.current.points.push([x, y]);
      updatePolyPreview();
      store.setCursor(x, y);
      return;
    }

    if (tool === 'text') {
      const rect = canvasRef.current!.getBoundingClientRect();
      setTextPopover({ gx: x, gy: y, left: Math.min(e.clientX, rect.right - 40), top: Math.min(e.clientY + 12, (typeof window !== 'undefined' ? window.innerHeight : 600) - 60), value: '' });
      store.setCursor(x, y);
      return;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current && e.pointerId !== dragRef.current.pointerId) return;
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

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current && e.pointerId !== dragRef.current.pointerId) return;
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

  const onDoubleClick = () => { if (snapshot.tool === 'poly') closePoly(); };

  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        style={{ display: 'block', outline: 'none', touchAction: 'none', imageRendering: 'pixelated', maxWidth: '100%', height: 'auto' }}
      />
      {textPopover && (
        <div style={{ position: 'fixed', left: textPopover.left, top: textPopover.top, zIndex: 50, background: 'var(--ts-bg, #FFFFFF)', border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 8, padding: 6 }}>
          <input
            autoFocus
            value={textPopover.value}
            onChange={(e) => setTextPopover({ ...textPopover, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitText(); }
              else if (e.key === 'Escape') { e.preventDefault(); setTextPopover(null); }
            }}
            onBlur={commitText}
            aria-label="Tactile text"
            style={{ font: 'inherit' }}
          />
        </div>
      )}
    </div>
  );
}
