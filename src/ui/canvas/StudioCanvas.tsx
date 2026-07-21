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

import React, { useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import { line, rectOutline, ellipseOutline, makeBrush, floodFill } from '../../core/geometry/raster.js';
import { cellIndex, inBounds } from '../../core/grid/grid.js';
import { stampTextLayout, type GlyphRasterizer } from '../../codecs/tactile-text/tactile-text.js';
import { browserGlyphRasterizer } from './browser-glyph-rasterizer.js';
import { ZoomControls } from './ZoomControls.js';
import type { StudioLabels } from '../../react/types/public-api.js';

function cellPx(gridW: number): number {
  return gridW <= 28 ? 20 : gridW <= 60 ? 13 : gridW <= 84 ? 7 : 9;
}

type DragState =
  | { mode: 'paint'; value: 0 | 1; size: number; lastX: number; lastY: number; pointerId: number }
  | { mode: 'shape'; x0: number; y0: number; x1: number; y1: number; snap: 0 | 5 | 10; preview: Set<number>; pointerId: number }
  | { mode: 'sel'; x0: number; y0: number; snap: 0 | 5 | 10; pointerId: number }
  | null;

function snapToGuide(value: number, step: 0 | 5 | 10, max: number): number {
  if (!step) return value;
  return Math.max(0, Math.min(max, Math.round(value / step) * step));
}

export interface StudioCanvasProps {
  /** ARIA label for the canvas (host-supplied, since Studio owns no i18n). */
  ariaLabel?: string;
  /** Overrides the real canvas-based glyph rasterizer — for tests only. */
  glyphRasterizer?: GlyphRasterizer;
  /** Passed through to the zoom pill's button labels/tooltips. */
  labels?: StudioLabels;
  /** Center cross-hair guide (horizontal + vertical line through the grid's
   *  midpoint) — a sighted-collaborator layout aid only, toggled from the
   *  toolbar (see Toolbar's crosshair IconButton). Purely visual: never
   *  written to cells, never exported, doesn't affect DotPad output. */
  showCenterGuide?: boolean;
}

export function StudioCanvas({ ariaLabel, glyphRasterizer = browserGlyphRasterizer, labels, showCenterGuide = false }: StudioCanvasProps) {
  const { snapshot, store } = useEditorStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const rafRef = useRef<number | null>(null);
  const polyRef = useRef<{ points: Array<[number, number]>; preview: Set<number> }>({ points: [], preview: new Set() });
  const [textPopover, setTextPopover] = useState<{ gx: number; gy: number; left: number; top: number; value: string } | null>(null);
  // Zoom scroll-anchoring refs (verbatim port of the monolith's
  // zoomAround/zoomAtViewportCenter — see the useLayoutEffect and onWheel
  // handler near the return statement for the actual math and their own
  // doc comments for why this needed a real scrollable viewport at all).
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const prevZoomRef = useRef(snapshot.zoom);
  const pendingAnchorRef = useRef<{ x: number; y: number } | null>(null);

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

    // Center cross-hair guide — a passive layout aid (see StudioCanvasProps
    // doc comment), drawn under the active-editing overlays below so a live
    // drag/selection/cursor is never visually competing with it. Subtle
    // dashed accent line, distinct from the stronger solid/dashed orange
    // used for actual selection and drag-snap feedback further down.
    if (showCenterGuide) {
      g.save();
      g.strokeStyle = 'rgba(196,61,0,0.35)';
      g.lineWidth = 1;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(cv.width / 2, 0); g.lineTo(cv.width / 2, cv.height);
      g.moveTo(0, cv.height / 2); g.lineTo(cv.width, cv.height / 2);
      g.stroke();
      g.restore();
    }

    const drag = dragRef.current;
    if (drag && drag.mode === 'shape') {
      g.fillStyle = 'rgba(196,61,0,0.85)';
      drag.preview.forEach((i) => {
        const x = i % gridW, y = (i / gridW) | 0;
        g.beginPath(); g.arc(x * c + c / 2, y * c + c / 2, c * 0.36, 0, Math.PI * 2); g.fill();
      });
      // A restrained endpoint marker confirms that Shift/Alt snapping is active
      // without covering the tactile dots themselves. It is an editing aid only.
      if (drag.snap) {
        const px = drag.x1 * c + c / 2, py = drag.y1 * c + c / 2;
        g.save();
        g.strokeStyle = 'rgba(196,61,0,0.72)'; g.lineWidth = 1;
        g.setLineDash([2, 2]);
        g.beginPath(); g.moveTo(px - c * 0.65, py); g.lineTo(px + c * 0.65, py); g.moveTo(px, py - c * 0.65); g.lineTo(px, py + c * 0.65); g.stroke();
        g.restore();
      }
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
  }, [gridW, gridH, c, snapshot.selRect, snapshot.tool, snapshot.cursor, store, showCenterGuide]);

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

  const snapForEvent = (e: Pick<React.PointerEvent<HTMLCanvasElement>, 'shiftKey' | 'altKey'>): 0 | 5 | 10 => e.altKey ? 10 : e.shiftKey ? 5 : 0;
  const snappedCell = (e: React.PointerEvent<HTMLCanvasElement>): [number, number, 0 | 5 | 10] => {
    const [rawX, rawY] = evCell(e), snap = snapForEvent(e);
    return [snapToGuide(rawX, snap, gridW - 1), snapToGuide(rawY, snap, gridH - 1), snap];
  };

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
    const [rawX, rawY] = evCell(e);
    const tool = snapshot.tool;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* capture is an optimization, never fatal */ }

    if (tool === 'cursor') { store.setCursor(rawX, rawY); return; }

    if (tool === 'pen' || tool === 'eraser') {
      const value: 0 | 1 = tool === 'pen' ? 1 : 0;
      const size = strokeSizeFor(tool);
      store.beginStroke();
      const plot = makeBrush((px, py) => { if (inBounds(gridW, gridH, px, py)) store.getActiveCells()[cellIndex(gridW, px, py)] = value; }, size);
      store.paintDuring(() => plot(rawX, rawY));
      dragRef.current = { mode: 'paint', value, size, lastX: rawX, lastY: rawY, pointerId: e.pointerId };
      store.setCursor(rawX, rawY);
      scheduleDragRedraw();
      return;
    }

    if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      const [x, y, snap] = snappedCell(e);
      dragRef.current = { mode: 'shape', x0: x, y0: y, x1: x, y1: y, snap, preview: new Set([cellIndex(gridW, x, y)]), pointerId: e.pointerId };
      store.setCursor(x, y);
      scheduleDragRedraw();
      return;
    }

    if (tool === 'fill') {
      store.mutateActiveCells((cells) => floodFill(cells, gridW, gridH, rawX, rawY));
      store.setCursor(rawX, rawY);
      return;
    }

    if (tool === 'select') {
      const [x, y, snap] = snappedCell(e);
      dragRef.current = { mode: 'sel', x0: x, y0: y, snap, pointerId: e.pointerId };
      store.setSelRect({ x0: x, y0: y, x1: x, y1: y });
      store.setCursor(x, y);
      return;
    }

    if (tool === 'poly') {
      const [x, y] = snappedCell(e);
      polyRef.current.points.push([x, y]);
      updatePolyPreview();
      store.setCursor(x, y);
      return;
    }

    if (tool === 'text') {
      const rect = canvasRef.current!.getBoundingClientRect();
      setTextPopover({ gx: rawX, gy: rawY, left: Math.min(e.clientX, rect.right - 40), top: Math.min(e.clientY + 12, (typeof window !== 'undefined' ? window.innerHeight : 600) - 60), value: '' });
      store.setCursor(rawX, rawY);
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
      const snap = snapForEvent(e);
      const sx = snapToGuide(x, snap, gridW - 1), sy = snapToGuide(y, snap, gridH - 1);
      const s = new Set<number>();
      const add = makeBrush((px, py) => { if (inBounds(gridW, gridH, px, py)) s.add(cellIndex(gridW, px, py)); }, strokeSizeFor(snapshot.tool));
      if (snapshot.tool === 'line') line(drag.x0, drag.y0, sx, sy, add);
      else if (snapshot.tool === 'rect') rectOutline(drag.x0, drag.y0, sx, sy, add);
      else ellipseOutline(drag.x0, drag.y0, sx, sy, add);
      drag.preview = s; drag.x1 = sx; drag.y1 = sy; drag.snap = snap;
      scheduleDragRedraw();
    } else if (drag.mode === 'sel') {
      const snap = snapForEvent(e);
      const sx = snapToGuide(x, snap, gridW - 1), sy = snapToGuide(y, snap, gridH - 1);
      drag.snap = snap;
      store.setSelRect({ x0: Math.min(drag.x0, sx), y0: Math.min(drag.y0, sy), x1: Math.max(drag.x0, sx), y1: Math.max(drag.y0, sy) });
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const { cx, cy } = snapshot.cursor;
    const step = e.altKey ? 10 : e.shiftKey ? 5 : 1;
    const move = (x: number, y: number) => {
      e.preventDefault();
      const nx = Math.max(0, Math.min(gridW - 1, x)), ny = Math.max(0, Math.min(gridH - 1, y));
      store.setCursor(nx, ny);
      store.announce(`Row ${ny + 1}, column ${nx + 1}.`);
    };
    if (e.key === 'ArrowLeft') return move(cx - step, cy);
    if (e.key === 'ArrowRight') return move(cx + step, cy);
    if (e.key === 'ArrowUp') return move(cx, cy - step);
    if (e.key === 'ArrowDown') return move(cx, cy + step);
    if (e.key.toLowerCase() === 'u') { e.preventDefault(); store.undo(); return; }
    if (e.key.toLowerCase() === 'r') { e.preventDefault(); store.redo(); return; }
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (snapshot.tool === 'fill') store.mutateActiveCells((cells) => floodFill(cells, gridW, gridH, cx, cy));
    else {
      const value: 0 | 1 = snapshot.tool === 'eraser' ? 0 : snapshot.tool === 'pen' ? 1 : (store.getActiveCells()[cellIndex(gridW, cx, cy)] ? 0 : 1);
      store.mutateActiveCells((cells) => { makeBrush((x, y) => { if (inBounds(gridW, gridH, x, y)) cells[cellIndex(gridW, x, y)] = value; }, strokeSizeFor(snapshot.tool))(cx, cy); });
    }
    const raised = !!store.getActiveCells()[cellIndex(gridW, cx, cy)];
    store.announce(`Row ${cy + 1}, column ${cx + 1}: ${raised ? 'raised' : 'lowered'}.`);
  };

  // Zoom-scaled CSS size (verbatim port of the monolith's canvasStyle
  // branch, index.html's `st.zoom === 1 ? {...} : {...width/height...}`):
  // at 1x, let the browser fit the canvas within its container as before
  // (maxWidth:100%, height:auto); at any other zoom, size it explicitly to
  // gridW/gridH * cellPx * zoom so it renders at the requested magnification
  // rather than being auto-fit. Scroll-position anchoring for the resulting
  // overflow now lives just below (see the useLayoutEffect's own comment).
  const zoom = snapshot.zoom;
  const canvasStyle: React.CSSProperties = zoom === 1
    ? { display: 'block', outline: 'none', touchAction: 'none', imageRendering: 'pixelated', maxWidth: '100%', height: 'auto' }
    : { display: 'block', outline: 'none', touchAction: 'none', imageRendering: 'pixelated', width: gridW * c * zoom, height: gridH * c * zoom };

  // Scroll-position anchoring (verbatim port of the monolith's zoomAround/
  // zoomAtViewportCenter, index.html's "Canvas zoom (Figma-style)" section):
  // re-derives viewportRef's scrollLeft/scrollTop after every zoom change so
  // whatever point was under the anchor stays visually put, instead of the
  // content jumping to a different part of the canvas. Runs as a layout
  // effect (before paint) so the corrected scroll position is never
  // flashed/visible mid-jump, matching the monolith's own setState-callback
  // timing (it adjusts scroll synchronously once the resize from the new
  // zoom has been committed to the DOM).
  //
  // Anchor priority: pendingAnchorRef (set by onWheel just before the store
  // update, holding the exact mouse position for that gesture) if present,
  // else the viewport's own center (matching zoomAtViewportCenter, used by
  // the pill buttons and Ctrl/Cmd +/-/0 keyboard shortcuts -- neither of
  // which have a "mouse position" of their own to anchor to).
  useLayoutEffect(() => {
    const oldZoom = prevZoomRef.current;
    const newZoom = snapshot.zoom;
    prevZoomRef.current = newZoom;
    if (oldZoom === newZoom) return;
    const el = viewportRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const anchor = pendingAnchorRef.current ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    pendingAnchorRef.current = null;
    const ax = anchor.x - r.left, ay = anchor.y - r.top;   // anchor, viewport-relative
    const px = el.scrollLeft + ax, py = el.scrollTop + ay; // same point, in content coordinates
    const ratio = newZoom / oldZoom;
    el.scrollLeft = px * ratio - ax;
    el.scrollTop = py * ratio - ay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.zoom]);

  // Ctrl/Cmd+wheel (and trackpad pinch, which browsers report as a ctrlKey
  // wheel event) zooms continuously around the mouse position -- verbatim
  // port of the monolith's cvWheel. Plain wheel (no modifier) is NOT
  // preventDefault'd, so the viewport's native overflow:auto scroll/pan
  // still works exactly as it would on any scrollable div.
  const onViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    pendingAnchorRef.current = { x: e.clientX, y: e.clientY };
    store.setZoomClamped(snapshot.zoom * factor);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', height: 'var(--ts-canvas-viewport-height, min(70vh, 640px))' }}>
      <div
        ref={viewportRef}
        data-testid="canvas-viewport"
        onWheel={onViewportWheel}
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 20 }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="img"
            aria-label={`${ariaLabel || 'Tactile drawing canvas'}. Arrow keys move; Shift moves 5 cells and Alt moves 10. Hold Shift while shaping to snap to 5 cells, or Alt to snap to 10. Space or Enter edits, U undoes, R redoes.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            onKeyDown={onKeyDown}
            style={canvasStyle}
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
      </div>
      {/* OUTSIDE viewportRef, deliberately -- a verbatim port of vanilla's
          own nesting (its zoom pill is a sibling AFTER the scrolling
          viewport div closes, both children of the same outer, non-
          scrolling, position:relative "canvas zone"). If ZoomControls were
          nested INSIDE the scrolling viewport instead, it would scroll out
          of view along with the canvas at high zoom/pan offsets, instead of
          staying fixed in the corner the way it does here and in vanilla. */}
      <ZoomControls labels={labels} />
    </div>
  );
}
