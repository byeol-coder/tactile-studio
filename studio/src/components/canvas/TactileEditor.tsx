import { useId, useRef } from 'react';
import { RESOLUTION_DIMS, type TactileDocument } from '../../types/tactile';
import { useCellCursor } from '../../hooks/useCellCursor';
import { rectContains } from '../../geometry/region';
import styles from './TactileCanvas.module.css';

const TWO_POINT = new Set(['line', 'rect', 'ellipse']);

interface Props {
  document: TactileDocument;
}

/**
 * Keyboard- and pointer-navigable, editable tactile grid (spec F1.2 + F1.3/F1.7).
 *
 * A focusable `application` region owns the interaction; {@link useCellCursor}
 * handles cursor movement, keyboard toggling, and pointer painting — all through
 * the canonical document command path (undoable). The SVG is aria-hidden so the
 * live regions are the single source of spoken feedback.
 */
export function TactileEditor({ document }: Props) {
  const {
    cursor,
    onKeyDown,
    pointerPaint,
    activeTool,
    previewCells,
    beginShape,
    commitShape,
    addPolygonPoint,
    closePolygon,
    cancelShape,
    bucketFill,
    selection,
    selectionDest,
    beginSelect,
    finishSelect,
    setSelectionOffset,
    commitSelection,
    cancelSelection,
    canvasLabel,
    keyboardHint,
    announcement,
    alert,
  } = useCellCursor();
  const { width, height } = RESOLUTION_DIMS[document.resolution];
  const u = 10;
  const hintId = useId();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const painting = useRef(false);
  const strokeId = useRef<string | null>(null);
  const strokeSeq = useRef(0);
  const draggingShape = useRef(false); // mid-drag for a two-point shape
  const definingSelect = useRef(false); // mid-drag defining a selection
  const movingSelect = useRef<{ grabX: number; grabY: number; baseDx: number; baseDy: number } | null>(null);

  const cellFromEvent = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = Math.floor(((clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * height);
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // primary button only
    const cell = cellFromEvent(e.clientX, e.clientY);
    if (!cell) return;
    e.currentTarget.focus(); // keep keyboard continuity after a click
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic/absent pointer — capture is best-effort */
    }
    if (TWO_POINT.has(activeTool)) {
      // Drag: down = start anchor, up = commit. Preview follows the cursor.
      draggingShape.current = true;
      beginShape(cell.x, cell.y);
      return;
    }
    if (activeTool === 'polygon') {
      // Click adds a vertex; double-click closes (see onDoubleClick).
      addPolygonPoint(cell.x, cell.y);
      return;
    }
    if (activeTool === 'bucket') {
      // Single click floods the region — no drag/stroke.
      bucketFill(cell.x, cell.y);
      return;
    }
    if (activeTool === 'select') {
      if (selectionDest && rectContains(selectionDest, cell.x, cell.y)) {
        // Grab the placed selection to move it; release commits.
        movingSelect.current = {
          grabX: cell.x,
          grabY: cell.y,
          baseDx: selectionDest.x0 - selection!.x0,
          baseDy: selectionDest.y0 - selection!.y0,
        };
      } else {
        // Start defining a new rectangle; release finalizes it.
        definingSelect.current = true;
        beginSelect(cell.x, cell.y);
      }
      return;
    }
    painting.current = true;
    strokeId.current = `stroke-${++strokeSeq.current}`;
    pointerPaint(cell.x, cell.y, { strokeId: strokeId.current, announce: true });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cell = cellFromEvent(e.clientX, e.clientY);
    if (!cell) return;
    if (draggingShape.current || definingSelect.current) {
      // Move the cursor only (no commit) so the preview rect updates live.
      pointerPaint(cell.x, cell.y, { announce: false });
      return;
    }
    if (movingSelect.current) {
      const g = movingSelect.current;
      setSelectionOffset(g.baseDx + (cell.x - g.grabX), g.baseDy + (cell.y - g.grabY));
      return;
    }
    if (!painting.current || strokeId.current === null) return;
    // Same strokeId → merged into one undo step; no-op cells are filtered.
    pointerPaint(cell.x, cell.y, { strokeId: strokeId.current, announce: false });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingShape.current) {
      const cell = cellFromEvent(e.clientX, e.clientY);
      commitShape(cell ? cell.x : cursor.x, cell ? cell.y : cursor.y);
      draggingShape.current = false;
      return;
    }
    if (definingSelect.current) {
      const cell = cellFromEvent(e.clientX, e.clientY);
      finishSelect(cell ? cell.x : cursor.x, cell ? cell.y : cursor.y);
      definingSelect.current = false;
      return;
    }
    if (movingSelect.current) {
      commitSelection();
      movingSelect.current = null;
      return;
    }
    painting.current = false;
    strokeId.current = null;
  };

  const onPointerCancel = () => {
    if (draggingShape.current) {
      draggingShape.current = false;
      cancelShape();
      return;
    }
    if (definingSelect.current || movingSelect.current) {
      definingSelect.current = false;
      movingSelect.current = null;
      cancelSelection();
      return;
    }
    painting.current = false;
    strokeId.current = null;
  };

  const onDoubleClick = () => {
    if (activeTool === 'polygon') closePolygon();
  };

  const drawing =
    activeTool === 'pen' ||
    activeTool === 'eraser' ||
    TWO_POINT.has(activeTool) ||
    activeTool === 'polygon' ||
    activeTool === 'bucket' ||
    activeTool === 'select';

  const marquee = (rect: { x0: number; y0: number; x1: number; y1: number }, className: string, key: string) => (
    <rect
      key={key}
      className={className}
      x={rect.x0 * u}
      y={rect.y0 * u}
      width={(rect.x1 - rect.x0 + 1) * u}
      height={(rect.y1 - rect.y0 + 1) * u}
    />
  );

  return (
    <div className={styles.frame}>
      <div
        className={styles.editable}
        role="application"
        tabIndex={0}
        aria-label={canvasLabel}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={onDoubleClick}
        style={{ cursor: drawing ? 'crosshair' : 'default' }}
      >
        <svg
          ref={svgRef}
          className={styles.surface}
          viewBox={`0 0 ${width * u} ${height * u}`}
          aria-hidden="true"
        >
          {document.cells.map((c) => (
            <circle
              key={`${c.x}-${c.y}`}
              cx={c.x * u + u / 2}
              cy={c.y * u + u / 2}
              r={c.active ? u * 0.34 : u * 0.16}
              fill={c.active ? '#1a1a1a' : '#e4e2df'}
            />
          ))}
          {/* Transient Line preview (not committed until pointer-up / 2nd Space). */}
          {previewCells.map((p) => (
            <circle
              key={`preview-${p.x}-${p.y}`}
              className={styles.preview}
              cx={p.x * u + u / 2}
              cy={p.y * u + u / 2}
              r={u * 0.3}
            />
          ))}
          {/* Select tool marquees: source (dashed) + destination (accent). */}
          {selection && marquee(selection, styles.selectSource, 'sel-src')}
          {selectionDest && marquee(selectionDest, styles.selectDest, 'sel-dest')}
          <rect
            className={styles.cursor}
            x={cursor.x * u}
            y={cursor.y * u}
            width={u}
            height={u}
            rx={2}
          />
        </svg>
      </div>

      {/* Keyboard instructions, linked via aria-describedby. */}
      <p id={hintId} className="sr-only">
        {keyboardHint}
      </p>

      {/* Polite live region: cursor movement, toggle results, boundaries. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      {/* Assertive live region: blocking errors only. */}
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {alert}
      </div>
    </div>
  );
}
