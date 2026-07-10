// src/codecs/vector/vectorize.ts
//
// Verbatim port of the monolith's raster→vector pipeline (vectorizeGrid and
// its _vec* helpers). Fully pure (grid in, objects out) — no DOM dependency,
// which made it a clean Phase 3 extraction target. Every constant, traversal
// order, and rounding rule is preserved exactly; parity tests compare object
// arrays against the live shipped code with the same seeded inputs.
//
// Do not "clean up" the RDP open/closed-loop split, the contour-tracing edge
// convention, or the shape classifier's magic numbers (0.6px axis tolerance,
// cv < 0.18 ellipse threshold, etc.) — they were tuned against real tactile
// output and changing them changes what shapes users get.

import type { CellGrid } from '../../core/types.js';

export type Point = [number, number];

export interface VectorObject {
  type: 'rect' | 'ellipse' | 'polyline' | 'line';
  points: Point[];
  closed: boolean;
  bbox: { x: number; y: number; w: number; h: number };
}

export interface VectorizeStats {
  componentCount: number;
  objectCount: number;
  ignoredSmall: number;
  ignoredDegenerate: number;
  totalRawPoints: number;
  totalSimplifiedPoints: number;
  tooFragmented: boolean;
  truncated: boolean;
  error?: boolean;
}

export interface VectorizeOptions {
  tolerance?: number;
  minArea?: number;
  minGap?: number;
  minLoopPoints?: number;
  maxObjects?: number;
}

export interface VectorizeResult {
  objects: VectorObject[];
  stats: VectorizeStats;
}

// ── connected components (4-connected flood, stack-based) ───────────────────
export function connectedComponents(cells: CellGrid, w: number, h: number): number[][] {
  const labels = new Int32Array(w * h).fill(-1);
  const comps: number[][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!cells[i] || labels[i] !== -1) continue;
      const compId = comps.length;
      const stack = [i];
      labels[i] = compId;
      const pixels: number[] = [];
      while (stack.length) {
        const cur = stack.pop() as number;
        pixels.push(cur);
        const cx = cur % w, cy = (cur - cx) / w;
        const nbrs: Point[] = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
        for (let k = 0; k < 4; k++) {
          const nx = nbrs[k][0], ny = nbrs[k][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (cells[ni] && labels[ni] === -1) { labels[ni] = compId; stack.push(ni); }
        }
      }
      comps.push(pixels);
    }
  }
  return comps;
}

// ── contour tracing (boundary-edge walk) ────────────────────────────────────
export function traceContours(pixelIdx: number[], w: number, h: number): Point[][] {
  const pixSet = new Set(pixelIdx);
  const has = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && pixSet.has(y * w + x);
  const key = (x: number, y: number) => x + ',' + y;
  const nextFrom = new Map<string, Point>();
  const addEdge = (x1: number, y1: number, x2: number, y2: number) => nextFrom.set(key(x1, y1), [x2, y2]);
  for (const idx of pixelIdx) {
    const x = idx % w, y = (idx - x) / w;
    if (!has(x, y - 1)) addEdge(x, y, x + 1, y);
    if (!has(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
    if (!has(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
    if (!has(x - 1, y)) addEdge(x, y + 1, x, y);
  }
  const visited = new Set<string>();
  const loops: Point[][] = [];
  for (const [startKey] of nextFrom) {
    if (visited.has(startKey)) continue;
    let curKey = startKey;
    const loop: Point[] = [startKey.split(',').map(Number) as Point];
    let guard = 0;
    while (guard++ < 100000) {
      visited.add(curKey);
      const next = nextFrom.get(curKey);
      if (!next) break;
      const nk = next[0] + ',' + next[1];
      loop.push(next);
      if (nk === startKey) break;
      if (visited.has(nk)) break;
      curKey = nk;
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

function sqSegDist(p: Point, a: Point, b: Point): number {
  let x = a[0], y = a[1];
  const dx0 = b[0] - x, dy0 = b[1] - y;
  let dx = dx0, dy = dy0;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
}

function rdpOpen(points: Point[], first: number, last: number, sqTolerance: number, out: Point[]): void {
  let maxDist = sqTolerance, index = -1;
  for (let i = first + 1; i < last; i++) {
    const d = sqSegDist(points[i], points[first], points[last]);
    if (d > maxDist) { index = i; maxDist = d; }
  }
  if (index !== -1) {
    if (index - first > 1) rdpOpen(points, first, index, sqTolerance, out);
    out.push(points[index]);
    if (last - index > 1) rdpOpen(points, index, last, sqTolerance, out);
  }
}

/** Ramer–Douglas–Peucker for both open polylines and closed loops (a closed
 *  loop needs two independent anchors — see monolith comment, ported below). */
export function rdp(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points.slice();
  const sqTolerance = tolerance * tolerance;
  const n = points.length;
  const isClosed = Math.hypot(points[0][0] - points[n - 1][0], points[0][1] - points[n - 1][1]) < 1e-6;
  if (!isClosed) {
    const out: Point[] = [points[0]];
    rdpOpen(points, 0, n - 1, sqTolerance, out);
    out.push(points[n - 1]);
    return out;
  }
  const distinct = points.slice(0, n - 1);
  const m = distinct.length;
  if (m < 3) return points.slice();
  let farIdx = 1, farDist = -1;
  for (let i = 1; i < m; i++) {
    const d = (distinct[i][0] - distinct[0][0]) ** 2 + (distinct[i][1] - distinct[0][1]) ** 2;
    if (d > farDist) { farDist = d; farIdx = i; }
  }
  const arc1 = distinct.slice(0, farIdx + 1);
  const arc2 = distinct.slice(farIdx).concat([distinct[0]]);
  const out1: Point[] = [arc1[0]]; rdpOpen(arc1, 0, arc1.length - 1, sqTolerance, out1); out1.push(arc1[arc1.length - 1]);
  const out2: Point[] = [arc2[0]]; rdpOpen(arc2, 0, arc2.length - 1, sqTolerance, out2); out2.push(arc2[arc2.length - 1]);
  return out1.concat(out2.slice(1));
}

export function classifyShape(pts: Point[], bbox: { minX: number; minY: number; maxX: number; maxY: number }): 'rect' | 'ellipse' | 'polyline' {
  const w = bbox.maxX - bbox.minX, h = bbox.maxY - bbox.minY;
  const area = w * h;
  if (area <= 0) return 'polyline';
  const core = (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) ? pts.slice(0, -1) : pts;
  if (core.length >= 4 && core.length <= 6) {
    let axisAligned = true;
    for (let i = 0; i < core.length; i++) {
      const a = core[i], b = core[(i + 1) % core.length];
      if (Math.abs(a[0] - b[0]) > 0.6 && Math.abs(a[1] - b[1]) > 0.6) { axisAligned = false; break; }
    }
    if (axisAligned) return 'rect';
  }
  const cx = (bbox.minX + bbox.maxX) / 2, cy = (bbox.minY + bbox.maxY) / 2;
  if (pts.length >= 8) {
    let sum = 0, sumSq = 0;
    for (const p of pts) { const r = Math.hypot(p[0] - cx, p[1] - cy); sum += r; sumSq += r * r; }
    const mean = sum / pts.length;
    const variance = sumSq / pts.length - mean * mean;
    const cv = mean > 0 ? Math.sqrt(Math.max(0, variance)) / mean : 1;
    if (cv < 0.18 && mean > 0) return 'ellipse';
  }
  return 'polyline';
}

export function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    a += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return Math.abs(a) / 2;
}

export function bboxOf(pts: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
  }
  return { minX, minY, maxX, maxY };
}

export function mergeClosePoints(pts: Point[], minGap: number): Point[] {
  if (pts.length < 3) return pts.slice();
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const last = out[out.length - 1], p = pts[i];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= minGap || i === pts.length - 1) out.push(p);
  }
  return out;
}

export function farthestPair(pts: Point[]): Point[] {
  let best: Point[] = [pts[0], pts[1] || pts[0]], bestD = -1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = (pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2;
      if (d > bestD) { bestD = d; best = [pts[i], pts[j]]; }
    }
  }
  return best;
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Main entry point (monolith: vectorizeGrid). Never throws; a pathological
 * input degrades to many small objects + stats.tooFragmented rather than
 * crashing — a caught error inside contour tracing simply skips that
 * component (matches the shipped `try { … } catch (e) { continue; }`).
 */
export function vectorizeGrid(cells: CellGrid, w: number, h: number, opts: VectorizeOptions = {}): VectorizeResult {
  const tolerance = opts.tolerance != null ? opts.tolerance : 1.1;
  const minArea = opts.minArea != null ? opts.minArea : 3;
  const minGap = opts.minGap != null ? opts.minGap : 0.8;
  const minLoopPoints = opts.minLoopPoints != null ? opts.minLoopPoints : 3;
  const maxObjects = opts.maxObjects != null ? opts.maxObjects : 400;

  let comps: number[][];
  try {
    comps = connectedComponents(cells, w, h);
  } catch {
    return { objects: [], stats: { error: true, componentCount: 0, objectCount: 0, ignoredSmall: 0, ignoredDegenerate: 0, totalRawPoints: 0, totalSimplifiedPoints: 0, tooFragmented: false, truncated: false } };
  }

  const objects: VectorObject[] = [];
  let ignoredSmall = 0, ignoredDegenerate = 0, totalRawPoints = 0, totalSimplifiedPoints = 0;

  outer:
  for (const pixels of comps) {
    if (pixels.length < minArea) { ignoredSmall++; continue; }
    let loops: Point[][];
    try { loops = traceContours(pixels, w, h); } catch { continue; }
    for (const loop of loops) {
      totalRawPoints += loop.length;
      let simplified = rdp(loop, tolerance);
      simplified = mergeClosePoints(simplified, minGap);
      const bbox0 = bboxOf(loop);
      const bboxDiag = Math.hypot(bbox0.maxX - bbox0.minX, bbox0.maxY - bbox0.minY);
      const area0 = polygonArea(simplified.length >= 3 ? simplified : loop);
      const tooThin = simplified.length < minLoopPoints || (area0 < minArea * 0.5 && bboxDiag >= 3);
      if (tooThin) {
        if (bboxDiag < 2) { ignoredDegenerate++; continue; }
        const pair = farthestPair(loop);
        objects.push({
          type: 'line',
          points: [[round1(pair[0][0]), round1(pair[0][1])], [round1(pair[1][0]), round1(pair[1][1])]],
          closed: false,
          bbox: { x: round1(bbox0.minX), y: round1(bbox0.minY), w: round1(bbox0.maxX - bbox0.minX), h: round1(bbox0.maxY - bbox0.minY) },
        });
        totalSimplifiedPoints += 2;
        if (objects.length >= maxObjects) break outer;
        continue;
      }
      totalSimplifiedPoints += simplified.length;
      const bbox = bboxOf(simplified);
      const area = polygonArea(simplified);
      if (area < minArea * 0.5) { ignoredDegenerate++; continue; }
      const shape = classifyShape(simplified, bbox);
      objects.push({
        type: shape,
        points: simplified.map((p) => [round1(p[0]), round1(p[1])]),
        closed: true,
        bbox: { x: round1(bbox.minX), y: round1(bbox.minY), w: round1(bbox.maxX - bbox.minX), h: round1(bbox.maxY - bbox.minY) },
      });
      if (objects.length >= maxObjects) break outer;
    }
  }

  const fragmentDensity = (w * h) > 0 ? objects.length / (w * h) : 0;
  const tooFragmented = objects.length > 60 || fragmentDensity > 0.06;
  return {
    objects,
    stats: { componentCount: comps.length, objectCount: objects.length, ignoredSmall, ignoredDegenerate, totalRawPoints, totalSimplifiedPoints, tooFragmented, truncated: objects.length >= maxObjects },
  };
}
