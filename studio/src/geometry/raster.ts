import type { CursorPos } from '../a11y/cursor';

/**
 * Bresenham line rasterization (spec F1.4).
 *
 * Returns the ordered list of integer grid cells on the line from (x0,y0) to
 * (x1,y1), inclusive of both endpoints. Pure and deterministic — the Line tool
 * feeds these cells into a single multi-cell DocumentCommand.
 */
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): CursorPos[] {
  const points: CursorPos[] = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;

  // Guard against pathological inputs so the loop always terminates.
  const maxSteps = dx + dy + 1;
  for (let i = 0; i <= maxSteps; i++) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

/**
 * Axis-aligned rectangle cells between two corners (spec F1.5).
 * `fill` → every cell in the box; otherwise just the border.
 */
export function rectCells(from: CursorPos, to: CursorPos, fill: boolean): CursorPos[] {
  const x0 = Math.min(from.x, to.x);
  const x1 = Math.max(from.x, to.x);
  const y0 = Math.min(from.y, to.y);
  const y1 = Math.max(from.y, to.y);
  const cells: CursorPos[] = [];
  if (fill) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells.push({ x, y });
    return cells;
  }
  for (let x = x0; x <= x1; x++) {
    cells.push({ x, y: y0 });
    if (y1 !== y0) cells.push({ x, y: y1 });
  }
  for (let y = y0 + 1; y < y1; y++) {
    cells.push({ x: x0, y });
    if (x1 !== x0) cells.push({ x: x1, y });
  }
  return cells;
}

/**
 * Ellipse cells inscribed in the bounding box of two corners (spec F1.5).
 * `fill` → all interior cells; otherwise the boundary (interior cells missing a
 * 4-neighbour). Robust for tiny/degenerate boxes.
 */
export function ellipseCells(from: CursorPos, to: CursorPos, fill: boolean): CursorPos[] {
  const x0 = Math.min(from.x, to.x);
  const x1 = Math.max(from.x, to.x);
  const y0 = Math.min(from.y, to.y);
  const y1 = Math.max(from.y, to.y);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.max((x1 - x0) / 2, 0.5);
  const ry = Math.max((y1 - y0) / 2, 0.5);
  const inside = (x: number, y: number): boolean => {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return nx * nx + ny * ny <= 1 + 1e-9;
  };

  const set = new Set<string>();
  const interior: CursorPos[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (inside(x, y)) {
        interior.push({ x, y });
        set.add(`${x},${y}`);
      }
    }
  }
  if (fill) return interior;
  return interior.filter(
    ({ x, y }) =>
      !(
        set.has(`${x - 1},${y}`) &&
        set.has(`${x + 1},${y}`) &&
        set.has(`${x},${y - 1}`) &&
        set.has(`${x},${y + 1}`)
      ),
  );
}

/**
 * Rasterize a polyline through `points` (Bresenham between consecutive points),
 * de-duplicated. `closed` adds the last→first edge (polygon commit); open is
 * used for the live rubber-band preview.
 */
export function polylineCells(points: CursorPos[], closed: boolean): CursorPos[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];
  const seen = new Set<string>();
  const out: CursorPos[] = [];
  const add = (c: CursorPos) => {
    const k = `${c.x},${c.y}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  };
  const segments = closed ? points.length : points.length - 1;
  for (let i = 0; i < segments; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    for (const c of bresenhamLine(a.x, a.y, b.x, b.y)) add(c);
  }
  return out;
}
