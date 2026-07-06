import type { CursorPos, Dims } from '../a11y/cursor';
import { polylineCells } from './raster';

/**
 * 4-connected flood fill (spec F1.6). Returns every cell reachable from `seed`
 * through orthogonal neighbours that share the seed's state, per the `get`
 * predicate. Bucket fill then inverts this region as one command. Pure, so it
 * tests without React (pass any state predicate).
 */
export function floodFill(seed: CursorPos, dims: Dims, get: (x: number, y: number) => boolean): CursorPos[] {
  const { width, height } = dims;
  if (seed.x < 0 || seed.y < 0 || seed.x >= width || seed.y >= height) return [];
  const target = get(seed.x, seed.y);
  const seen = new Set<string>([`${seed.x},${seed.y}`]);
  const region: CursorPos[] = [];
  const stack: CursorPos[] = [seed];
  const steps: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (stack.length) {
    const c = stack.pop() as CursorPos;
    region.push(c);
    for (const [dx, dy] of steps) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key) || get(nx, ny) !== target) continue;
      seen.add(key);
      stack.push({ x: nx, y: ny });
    }
  }
  return region;
}

/**
 * Fill a polygon's interior (scanline, even-odd rule) unioned with its outline,
 * so thin spurs are never dropped. Falls back to a closed outline for < 3
 * vertices. Sampling at y+0.5 avoids vertex degeneracies.
 */
export function polygonFillCells(points: CursorPos[]): CursorPos[] {
  if (points.length < 3) return polylineCells(points, true);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const seen = new Set<string>();
  const out: CursorPos[] = [];
  const add = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ x, y });
    }
  };

  for (let y = minY; y <= maxY; y++) {
    const sy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a.y <= sy && b.y > sy) || (b.y <= sy && a.y > sy)) {
        xs.push(a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) add(x, y);
    }
  }

  for (const c of polylineCells(points, true)) add(c.x, c.y);
  return out;
}
