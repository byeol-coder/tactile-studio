import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../app/appState';
import { RESOLUTION_DIMS } from '../types/tactile';
import { A11Y } from '../i18n/messages';
import { clampCursor, moveCursor, type CursorMove, type CursorPos } from '../a11y/cursor';
import { formatBoundary, formatPosition, formatToggle } from '../a11y/announce';
import { speak } from '../a11y/tts';
import { bresenhamLine, ellipseCells, polylineCells, rectCells } from '../geometry/raster';
import { floodFill, polygonFillCells } from '../geometry/fill';
import {
  clampOffset,
  normRect,
  regionMoveCells,
  rectHeight,
  rectWidth,
  shiftRect,
  type Rect,
} from '../geometry/region';
import type { ToolId } from '../i18n/messages';

const SUPPORTED = new Set(['60x40', '96x64']);
const TTS_DEBOUNCE_MS = 90;
/** Tools that draw between a start anchor and an end cell. */
const TWO_POINT = new Set<ToolId>(['line', 'rect', 'ellipse']);

/** Rasterize a two-point shape (line/rect/ellipse) to its cells. */
function twoPointCells(tool: ToolId, from: CursorPos, to: CursorPos, fill: boolean): CursorPos[] {
  if (tool === 'line') return bresenhamLine(from.x, from.y, to.x, to.y);
  if (tool === 'rect') return rectCells(from, to, fill);
  if (tool === 'ellipse') return ellipseCells(from, to, fill);
  return [];
}

/** Directional cursor moves → (dx,dy) deltas for nudging a selection. */
function moveToDelta(move: CursorMove): { dx: number; dy: number } | null {
  switch (move) {
    case 'up':
      return { dx: 0, dy: -1 };
    case 'down':
      return { dx: 0, dy: 1 };
    case 'left':
      return { dx: -1, dy: 0 };
    case 'right':
      return { dx: 1, dy: 0 };
    case 'up-10':
      return { dx: 0, dy: -10 };
    case 'down-10':
      return { dx: 0, dy: 10 };
    case 'left-10':
      return { dx: -10, dy: 0 };
    case 'right-10':
      return { dx: 10, dy: 0 };
    default:
      return null;
  }
}

/**
 * Keyboard-driven cell cursor for the tactile grid (spec F1.2).
 *
 * Owns cursor position + accessible announcements; editing goes through the
 * canonical TactileDocument via the store (no bypass path). Cursor logic is the
 * pure helpers in ../a11y/cursor; this hook only wires them to React state, the
 * keyboard, aria-live strings, and optional TTS.
 */
export function useCellCursor() {
  const { state, dispatch } = useAppStore();
  const { language: lang, ttsEnabled, document } = state;

  const resolution = document?.resolution ?? '60x40';
  const dims = RESOLUTION_DIMS[resolution];
  const supported = SUPPORTED.has(resolution);

  // Cursor position is shared app state (mirrored in the BottomPanel); the hook
  // owns interaction. Clamp defensively in case the grid changed this render.
  const cursor = clampCursor(state.cursor, dims);
  /** Polite announcement (cursor movement, toggles, boundaries). */
  const [announcement, setAnnouncement] = useState('');
  /** Assertive announcement (blocking errors only). */
  const [alert, setAlert] = useState('');
  /** Pending shape state — transient interaction only, NOT document state; the
   * document is mutated solely on commit. `shapeAnchor` is the start cell for
   * two-point shapes (line/rect/ellipse); `polygonPoints` accumulates vertices. */
  const [shapeAnchor, setShapeAnchor] = useState<CursorPos | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<CursorPos[]>([]);
  /** Select tool: first corner while defining, then the committed region + its
   * pending move offset. All transient — the document changes only on commit. */
  const [selectAnchor, setSelectAnchor] = useState<CursorPos | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [moveOffset, setMoveOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const tool = state.activeTool;
  const fill = state.shapeFill;
  const copy = state.selectCopy;

  // Abandon any pending shape/selection whenever the tool changes.
  useEffect(() => {
    setShapeAnchor(null);
    setPolygonPoints([]);
    setSelectAnchor(null);
    setSelection(null);
    setMoveOffset({ dx: 0, dy: 0 });
  }, [tool]);

  const isActiveAt = useCallback(
    (x: number, y: number): boolean => {
      const cell = document?.cells.find((c) => c.x === x && c.y === y);
      return Boolean(cell?.active);
    },
    [document],
  );

  // Debounced TTS so rapid arrow repeats don't stutter; speak() itself also
  // cancels any in-flight utterance, so the queue never grows.
  const ttsTimer = useRef<number | null>(null);
  const speakDebounced = useCallback(
    (text: string) => {
      if (!ttsEnabled) return;
      if (ttsTimer.current !== null) window.clearTimeout(ttsTimer.current);
      ttsTimer.current = window.setTimeout(() => {
        speak(text, { enabled: ttsEnabled, lang });
      }, TTS_DEBOUNCE_MS);
    },
    [ttsEnabled, lang],
  );
  useEffect(() => () => {
    if (ttsTimer.current !== null) window.clearTimeout(ttsTimer.current);
  }, []);

  const announce = useCallback(
    (message: string) => {
      setAnnouncement(message);
      speakDebounced(message);
    },
    [speakDebounced],
  );

  const applyMove = useCallback(
    (move: CursorMove) => {
      if (!supported) {
        setAlert(A11Y[lang].unsupportedGrid);
        return;
      }
      const { pos, boundary } = moveCursor(cursor, move, dims);
      if (boundary) {
        announce(formatBoundary(lang, boundary));
        return;
      }
      dispatch({ type: 'editor/cursor', x: pos.x, y: pos.y });
      announce(formatPosition(lang, pos, isActiveAt(pos.x, pos.y)));
    },
    [supported, cursor, dims, lang, announce, isActiveAt, dispatch],
  );

  const toggleCurrent = useCallback(() => {
    if (!supported) {
      setAlert(A11Y[lang].unsupportedGrid);
      return;
    }
    const newActive = !isActiveAt(cursor.x, cursor.y);
    dispatch({ type: 'document/toggle-cell', x: cursor.x, y: cursor.y });
    announce(formatToggle(lang, cursor, newActive));
  }, [supported, isActiveAt, cursor, dispatch, announce, lang]);

  /**
   * Apply the active tool at a grid cell (pointer path). Pen raises, Eraser
   * lowers, other tools just move the cursor. Moves the shared cursor to the
   * cell; announces only when asked (pointer-down), so drags stay quiet.
   * `strokeId` groups a drag gesture into one undo step.
   */
  const pointerPaint = useCallback(
    (x: number, y: number, opts: { strokeId?: string; announce?: boolean } = {}) => {
      if (!supported) {
        setAlert(A11Y[lang].unsupportedGrid);
        return;
      }
      const at = clampCursor({ x, y }, dims);
      dispatch({ type: 'editor/cursor', x: at.x, y: at.y });

      const tool = state.activeTool;
      if (tool === 'pen' || tool === 'eraser') {
        const value = tool === 'pen';
        const changed = isActiveAt(at.x, at.y) !== value;
        dispatch({ type: 'document/paint-cell', x: at.x, y: at.y, value, strokeId: opts.strokeId });
        if (opts.announce) {
          announce(changed ? formatToggle(lang, at, value) : formatPosition(lang, at, value));
        }
      } else if (opts.announce) {
        announce(formatPosition(lang, at, isActiveAt(at.x, at.y)));
      }
    },
    [supported, dims, dispatch, state.activeTool, isActiveAt, announce, lang],
  );

  /** Bucket fill (F1.6): invert the 4-connected same-state region at a cell. */
  const bucketFill = useCallback(
    (x: number, y: number) => {
      if (!supported) {
        setAlert(A11Y[lang].unsupportedGrid);
        return;
      }
      const at = clampCursor({ x, y }, dims);
      dispatch({ type: 'editor/cursor', x: at.x, y: at.y });
      const region = floodFill(at, dims, (cx, cy) => isActiveAt(cx, cy));
      const filled = !isActiveAt(at.x, at.y);
      dispatch({ type: 'document/paint-cells', cells: region, value: filled });
      announce(A11Y[lang].bucketDone(at.y + 1, at.x + 1, region.length, filled ? 'raised' : 'lowered'));
    },
    [supported, dims, dispatch, isActiveAt, announce, lang],
  );

  /** Two-point shape (line/rect/ellipse): set the start anchor at a cell. */
  const beginShape = useCallback(
    (x: number, y: number) => {
      if (!supported) {
        setAlert(A11Y[lang].unsupportedGrid);
        return;
      }
      const at = clampCursor({ x, y }, dims);
      dispatch({ type: 'editor/cursor', x: at.x, y: at.y });
      setShapeAnchor(at);
      announce(A11Y[lang].shapeStart(at.y + 1, at.x + 1));
    },
    [supported, dims, dispatch, announce, lang],
  );

  /** Two-point shape: rasterize anchor→(x,y) and commit as ONE command. */
  const commitShape = useCallback(
    (x: number, y: number) => {
      if (!supported || !shapeAnchor) return;
      const to = clampCursor({ x, y }, dims);
      const cells = twoPointCells(tool, shapeAnchor, to, fill);
      dispatch({ type: 'document/paint-cells', cells, value: true });
      dispatch({ type: 'editor/cursor', x: to.x, y: to.y });
      announce(A11Y[lang].shapeDone(A11Y[lang].toolName(tool), shapeAnchor.y + 1, shapeAnchor.x + 1, cells.length));
      setShapeAnchor(null);
    },
    [supported, shapeAnchor, dims, tool, fill, dispatch, announce, lang],
  );

  /** Polygon: add the current cell as a vertex. */
  const addPolygonPoint = useCallback(
    (x: number, y: number) => {
      if (!supported) {
        setAlert(A11Y[lang].unsupportedGrid);
        return;
      }
      const at = clampCursor({ x, y }, dims);
      dispatch({ type: 'editor/cursor', x: at.x, y: at.y });
      setPolygonPoints((pts) => {
        const last = pts[pts.length - 1];
        if (last && last.x === at.x && last.y === at.y) return pts; // ignore repeats
        const next = [...pts, at];
        announce(A11Y[lang].polygonPoint(next.length, at.y + 1, at.x + 1));
        return next;
      });
    },
    [supported, dims, dispatch, announce, lang],
  );

  /** Polygon: close the outline (last→first) and commit as ONE command. */
  const closePolygon = useCallback(() => {
    if (!supported) return;
    if (polygonPoints.length < 2) {
      announce(A11Y[lang].polygonNeedMore);
      return;
    }
    const cells = fill && polygonPoints.length >= 3 ? polygonFillCells(polygonPoints) : polylineCells(polygonPoints, true);
    dispatch({ type: 'document/paint-cells', cells, value: true });
    const first = polygonPoints[0];
    announce(A11Y[lang].shapeDone(A11Y[lang].toolName('polygon'), first.y + 1, first.x + 1, cells.length));
    setPolygonPoints([]);
  }, [supported, polygonPoints, fill, dispatch, announce, lang]);

  /** Cancel any pending shape (anchor or polygon). Returns true if cleared. */
  const cancelShape = useCallback(() => {
    if (!shapeAnchor && polygonPoints.length === 0) return false;
    setShapeAnchor(null);
    setPolygonPoints([]);
    announce(A11Y[lang].shapeCancelled);
    return true;
  }, [shapeAnchor, polygonPoints, announce, lang]);

  // ── Select / Move / Copy (F1.8) ──────────────────────────────────────────
  /** Set the first corner of a new selection. */
  const beginSelect = useCallback(
    (x: number, y: number) => {
      if (!supported) {
        setAlert(A11Y[lang].unsupportedGrid);
        return;
      }
      const at = clampCursor({ x, y }, dims);
      dispatch({ type: 'editor/cursor', x: at.x, y: at.y });
      setSelection(null);
      setMoveOffset({ dx: 0, dy: 0 });
      setSelectAnchor(at);
      announce(A11Y[lang].selectStart(at.y + 1, at.x + 1));
    },
    [supported, dims, dispatch, announce, lang],
  );

  /** Finalize the selection rectangle at the opposite corner. */
  const finishSelect = useCallback(
    (x: number, y: number) => {
      if (!supported || !selectAnchor) return;
      const at = clampCursor({ x, y }, dims);
      const rect = normRect(selectAnchor, at);
      dispatch({ type: 'editor/cursor', x: at.x, y: at.y });
      setSelection(rect);
      setSelectAnchor(null);
      setMoveOffset({ dx: 0, dy: 0 });
      announce(A11Y[lang].selectDone(rectWidth(rect), rectHeight(rect)));
    },
    [supported, selectAnchor, dims, dispatch, announce, lang],
  );

  /** Set the pending move offset (absolute), clamped to keep the region on-grid. */
  const setSelectionOffset = useCallback(
    (dx: number, dy: number) => {
      if (!selection) return;
      const off = clampOffset(selection, { dx, dy }, dims);
      setMoveOffset(off);
      const dest = shiftRect(selection, off.dx, off.dy);
      announce(A11Y[lang].selectMoved(dest.y0 + 1, dest.x0 + 1));
    },
    [selection, dims, announce, lang],
  );

  /** Nudge the selection by a relative delta (keyboard arrows). */
  const nudgeSelection = useCallback(
    (dx: number, dy: number) => {
      if (!selection) return;
      setSelectionOffset(moveOffset.dx + dx, moveOffset.dy + dy);
    },
    [selection, moveOffset, setSelectionOffset],
  );

  /** Commit the pending move/copy as ONE command, then clear the selection. */
  const commitSelection = useCallback(() => {
    if (!supported || !selection) return;
    const cells = regionMoveCells(
      selection,
      moveOffset,
      (cx, cy) => isActiveAt(cx, cy),
      dims,
      copy ? 'copy' : 'move',
    );
    dispatch({ type: 'document/set-cells', cells });
    announce(A11Y[lang].selectCommitted(copy, cells.length));
    setSelection(null);
    setMoveOffset({ dx: 0, dy: 0 });
  }, [supported, selection, moveOffset, dims, copy, isActiveAt, dispatch, announce, lang]);

  /** Cancel a pending selection. Returns true if one was cleared. */
  const cancelSelection = useCallback(() => {
    if (!selection && !selectAnchor) return false;
    setSelection(null);
    setSelectAnchor(null);
    setMoveOffset({ dx: 0, dy: 0 });
    announce(A11Y[lang].selectCancelled);
    return true;
  }, [selection, selectAnchor, announce, lang]);

  /** Destination rect the selection would move to (source shifted by offset). */
  const selectionDest: Rect | null = selection ? shiftRect(selection, moveOffset.dx, moveOffset.dy) : null;

  /** Transient preview cells for shape tools (never committed). Select uses
   * rect marquees (selectAnchor/selection/selectionDest) instead. */
  const previewCells: CursorPos[] =
    TWO_POINT.has(tool) && shapeAnchor
      ? twoPointCells(tool, shapeAnchor, cursor, fill)
      : tool === 'polygon' && polygonPoints.length > 0
        ? polylineCells([...polygonPoints, cursor], false)
        : [];

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const meta = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      let move: CursorMove | null = null;
      let handled = true;

      switch (e.key) {
        case 'ArrowUp':
          move = shift ? 'up-10' : 'up';
          break;
        case 'ArrowDown':
          move = shift ? 'down-10' : 'down';
          break;
        case 'ArrowLeft':
          move = shift ? 'left-10' : 'left';
          break;
        case 'ArrowRight':
          move = shift ? 'right-10' : 'right';
          break;
        case 'Home':
          move = meta ? 'grid-start' : 'row-start';
          break;
        case 'End':
          move = meta ? 'grid-end' : 'row-end';
          break;
        case 'Enter':
        case ' ':
          if (tool === 'polygon') {
            // Space adds a vertex; Enter closes the polygon.
            if (e.key === 'Enter') closePolygon();
            else addPolygonPoint(cursor.x, cursor.y);
          } else if (TWO_POINT.has(tool)) {
            // First press sets the start anchor, second commits the shape.
            if (shapeAnchor) commitShape(cursor.x, cursor.y);
            else beginShape(cursor.x, cursor.y);
          } else if (tool === 'bucket') {
            bucketFill(cursor.x, cursor.y);
          } else if (tool === 'select') {
            // idle → 1st corner; defining → 2nd corner; selected → commit move.
            if (selection) commitSelection();
            else if (selectAnchor) finishSelect(cursor.x, cursor.y);
            else beginSelect(cursor.x, cursor.y);
          } else {
            // cursor/pen/eraser keep the F1.2 flip-toggle behavior.
            toggleCurrent();
          }
          break;
        case 'Escape':
          // Cancel a pending shape/selection first; otherwise release focus.
          if (!cancelShape() && !cancelSelection()) e.currentTarget.blur();
          break;
        default:
          handled = false;
      }

      if (move) {
        // While a selection is active, arrows nudge the region instead of the
        // cursor (directional only; Home/End/grid moves are ignored then).
        if (tool === 'select' && selection) {
          const d = moveToDelta(move);
          if (d) nudgeSelection(d.dx, d.dy);
        } else {
          applyMove(move);
        }
      }
      // Prevent page scroll (arrows/space/home/end) and keep the binding scoped
      // to the focused canvas — but never swallow keys we don't handle.
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [
      applyMove,
      toggleCurrent,
      tool,
      shapeAnchor,
      cursor,
      beginShape,
      commitShape,
      addPolygonPoint,
      closePolygon,
      cancelShape,
      bucketFill,
      selection,
      selectAnchor,
      beginSelect,
      finishSelect,
      commitSelection,
      cancelSelection,
      nudgeSelection,
    ],
  );

  return {
    cursor,
    dims,
    resolution,
    supported,
    activeTool: state.activeTool,
    isActive: isActiveAt(cursor.x, cursor.y),
    announcement,
    alert,
    onKeyDown,
    pointerPaint,
    bucketFill,
    selection,
    selectAnchor,
    selectionDest,
    beginSelect,
    finishSelect,
    setSelectionOffset,
    commitSelection,
    cancelSelection,
    shapeAnchor,
    polygonPoints,
    previewCells,
    beginShape,
    commitShape,
    addPolygonPoint,
    closePolygon,
    cancelShape,
    /** Accessible label for the canvas container. */
    canvasLabel: A11Y[lang].canvasLabel(dims.width, dims.height),
    /** Concise keyboard instructions for aria-describedby. */
    keyboardHint: A11Y[lang].keyboardHint,
  };
}
