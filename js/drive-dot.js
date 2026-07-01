// ── Tactile Drive: Dot Matrix Preview ───────────────────────────
// Deterministic pseudo-random dot pattern per asset id, rendered as an
// inline SVG string. This is the recurring "tactile preview" motif used
// on cards, the detail page, and empty states — no real image assets
// needed, and it visually doubles as an honest stand-in for "this is
// what the DotPad output roughly looks like."

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
}

/**
 * @param {string} seed - stable per-asset key (asset id, optionally + action)
 * @param {'60x40'|'96x64'} resolution
 * @param {{cell?:number, radius?:number}} [opts]
 * @returns {string} inline <svg> markup
 */
export function dotMatrixSvg(seed, resolution = '60x40', opts = {}) {
  const dense = resolution === '96x64';
  const cols = dense ? 30 : 20;
  const rows = dense ? 20 : 13;
  const cell = opts.cell ?? 6;
  const rnd = hashSeed(seed + resolution);
  const w = cols * cell, h = rows * cell;
  let dots = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = rnd();
      if (v <= 0.62) continue;
      const big = v > 0.85;
      const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
      const r = big ? (cell * 0.36).toFixed(2) : (cell * 0.24).toFixed(2);
      dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${big ? 'var(--accent)' : '#F2ECDF'}" opacity="${big ? 1 : 0.85}"/>`;
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="촉각 미리보기 (${resolution} 해상도 시뮬레이션)">` +
    `<rect width="${w}" height="${h}" fill="#161310" rx="8"/>${dots}</svg>`;
}
