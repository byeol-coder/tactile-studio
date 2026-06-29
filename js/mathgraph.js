// ── Math Graph ────────────────────────────────────────────────
// Self-contained: recursive-descent expression parser + compiler +
// tactile plot renderer. No external dependencies.
// Routes here from the prompt when the input looks like "y = sin(x)".

// ─── Tokenizer ────────────────────────────────────────────────
const FUNCS = new Set(['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh',
  'abs','sqrt','cbrt','exp','log','ln','log2','log10','floor','ceil','round','sign']);
const CONSTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[0-9.eE]/.test(src[j])) {
        if ((src[j] === 'e' || src[j] === 'E') && /[+-]/.test(src[j + 1])) j++;
        j++;
      }
      toks.push({ t: 'num', v: parseFloat(src.slice(i, j)) });
      i = j; continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z0-9]/.test(src[j])) j++;
      toks.push({ t: 'name', v: src.slice(i, j).toLowerCase() });
      i = j; continue;
    }
    if ('+-*/^(),'.includes(c)) { toks.push({ t: c }); i++; continue; }
    throw new Error(`알 수 없는 문자: "${c}"`);
  }
  // implicit multiply: between [num|name|)] and [num|name|(]
  const out = [];
  for (let k = 0; k < toks.length; k++) {
    out.push(toks[k]);
    const a = toks[k], b = toks[k + 1];
    if (!b) continue;
    const aEnd = a.t === 'num' || a.t === 'name' || a.t === ')';
    const bStart = b.t === 'num' || (b.t === 'name' && !FUNCS.has(b.v)) || b.t === '(' ||
      (b.t === 'name' && FUNCS.has(b.v));
    // don't multiply a function-name token onto its own '(' — but a func name
    // following a value DOES get an implicit '*' (e.g. 3sin(x))
    if (aEnd && bStart && !(a.t === 'name' && FUNCS.has(a.v))) out.push({ t: '*' });
  }
  return out;
}

// ─── Parser (recursive descent → AST) ────────────────────────
function parse(toks) {
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const expect = (t) => { if (peek()?.t !== t) throw new Error(`"${t}" 기호가 필요해요`); return next(); };

  function parseExpr() {
    let node = parseTerm();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = next().t;
      node = { type: 'op', op, l: node, r: parseTerm() };
    }
    return node;
  }
  function parseTerm() {
    let node = parsePower();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = next().t;
      node = { type: 'op', op, l: node, r: parsePower() };
    }
    return node;
  }
  function parsePower() {
    const node = parseUnary();
    if (peek() && peek().t === '^') { next(); return { type: 'op', op: '^', l: node, r: parsePower() }; }
    return node;
  }
  function parseUnary() {
    if (peek() && (peek().t === '-' || peek().t === '+')) {
      const op = next().t;
      const v = parseUnary();
      return op === '-' ? { type: 'neg', v } : v;
    }
    return parsePrimary();
  }
  function parsePrimary() {
    const tk = peek();
    if (!tk) throw new Error('수식이 끝나지 않았어요');
    if (tk.t === 'num') { next(); return { type: 'num', v: tk.v }; }
    if (tk.t === '(') { next(); const e = parseExpr(); expect(')'); return e; }
    if (tk.t === 'name') {
      next();
      if (FUNCS.has(tk.v)) { expect('('); const arg = parseExpr(); expect(')'); return { type: 'call', name: tk.v, arg }; }
      if (tk.v === 'x') return { type: 'var' };
      if (tk.v in CONSTS) return { type: 'num', v: CONSTS[tk.v] };
      throw new Error(`알 수 없는 이름: "${tk.v}"`);
    }
    throw new Error('수식을 해석할 수 없어요');
  }

  const ast = parseExpr();
  if (pos < toks.length) throw new Error('수식에 불필요한 기호가 있어요');
  return ast;
}

function evalNode(n, x) {
  switch (n.type) {
    case 'num': return n.v;
    case 'var': return x;
    case 'neg': return -evalNode(n.v, x);
    case 'op': {
      const a = evalNode(n.l, x), b = evalNode(n.r, x);
      switch (n.op) { case '+': return a + b; case '-': return a - b;
        case '*': return a * b; case '/': return a / b; case '^': return Math.pow(a, b); }
      return NaN;
    }
    case 'call': {
      const a = evalNode(n.arg, x);
      switch (n.name) {
        case 'ln': return Math.log(a);
        case 'log': case 'log10': return Math.log10(a);
        case 'log2': return Math.log2(a);
        default: return (Math[n.name] || (() => NaN))(a);
      }
    }
  }
  return NaN;
}

/** Strip "y=" / "f(x)=" prefixes. */
export function normalizeExpr(src) {
  return src.trim().replace(/^\s*(y|f\s*\(\s*x\s*\)|f)\s*=\s*/i, '').trim();
}

/** Compile an expression string into { fn, error }. */
export function compileExpr(src) {
  try {
    const ast = parse(tokenize(normalizeExpr(src)));
    return { fn: (x) => evalNode(ast, x), error: null };
  } catch (e) {
    return { fn: null, error: e.message };
  }
}

/** Quick heuristic: does this prompt look like a math expression? */
export function isMathLike(src) {
  const s = src.trim();
  if (/^\s*(y|f\s*\(\s*x\s*\))\s*=/i.test(s)) return true;
  // contains x as a variable and at least one operator/function, no Korean
  if (/[가-힣]/.test(s)) return false;
  const hasX = /\bx\b/i.test(s) || /[a-z]\(/i.test(s);
  const hasOp = /[+\-*/^]/.test(s) || [...FUNCS].some(f => new RegExp('\\b' + f + '\\b', 'i').test(s));
  return hasX && hasOp;
}

// ─── Renderer ─────────────────────────────────────────────────
function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i];
}

/**
 * Render a math expression as a tactile plot.
 * Draws sparse axes (every 2nd pin) + the solid curve.
 * @returns {{ data:Uint8Array, error:?string, meta:object }}
 */
export function renderMathGraph(cols, rows, exprSrc, opts = {}) {
  const { fn, error } = compileExpr(exprSrc);
  if (error) return { data: new Uint8Array(cols * rows), error, meta: { expr: exprSrc } };

  const m = 2;                              // pixel margin
  const xMin = opts.xMin ?? -6.5, xMax = opts.xMax ?? 6.5;
  const N = cols * 3;                        // oversample for smooth curve
  const xs = [], ys = [];
  for (let k = 0; k <= N; k++) {
    const x = xMin + (xMax - xMin) * (k / N);
    const y = fn(x);
    xs.push(x); ys.push(Number.isFinite(y) ? y : NaN);
  }

  // Auto y-range from 5th–95th percentile (robust to asymptotes).
  let yMin = opts.yMin, yMax = opts.yMax;
  if (yMin == null || yMax == null) {
    const fin = ys.filter(Number.isFinite).sort((a, b) => a - b);
    if (!fin.length) return { data: new Uint8Array(cols * rows), error: '그릴 수 있는 값이 없어요', meta: { expr: exprSrc } };
    let lo = percentile(fin, 0.05), hi = percentile(fin, 0.95);
    if (lo === hi) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12;
    yMin = lo - pad; yMax = hi + pad;
  }

  const g = new Uint8Array(cols * rows);
  const plot = (px, py) => {
    px = Math.round(px); py = Math.round(py);
    if (px >= 0 && py >= 0 && px < cols && py < rows) g[py * cols + px] = 1;
  };
  const colOf = x => m + (x - xMin) / (xMax - xMin) * (cols - 1 - 2 * m);
  const rowOf = y => (rows - 1 - m) - (y - yMin) / (yMax - yMin) * (rows - 1 - 2 * m);

  // Sparse axes (every 2nd pin) for tactile orientation.
  if (yMin <= 0 && yMax >= 0) { const ay = Math.round(rowOf(0)); for (let x = 0; x < cols; x += 2) plot(x, ay); }
  if (xMin <= 0 && xMax >= 0) { const ax = Math.round(colOf(0)); for (let y = 0; y < rows; y += 2) plot(ax, y); }

  // Solid curve with pen-up across discontinuities/asymptotes.
  let prev = null;
  for (let k = 0; k <= N; k++) {
    const y = ys[k];
    if (!Number.isFinite(y) || y < yMin || y > yMax) { prev = null; continue; }
    const px = colOf(xs[k]), py = rowOf(y);
    if (prev && Math.abs(py - prev[1]) < rows * 0.5) {
      // bresenham between prev and current
      let x0 = Math.round(prev[0]), y0 = Math.round(prev[1]), x1 = Math.round(px), y1 = Math.round(py);
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      while (true) { plot(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x0 += sx; } if (e2 < dx) { err += dx; y0 += sy; } }
    } else { plot(px, py); }
    prev = [px, py];
  }

  return { data: g, error: null, meta: { expr: normalizeExpr(exprSrc), xMin, xMax, yMin, yMax } };
}

/** A few presets for the prompt suggestions. */
export const MATH_PRESETS = [
  { label: { ko: 'y = sin(x)', en: 'y = sin(x)' }, expr: 'sin(x)' },
  { label: { ko: 'y = x²',     en: 'y = x^2' },     expr: 'x^2' },
  { label: { ko: 'y = 1/x',    en: 'y = 1/x' },     expr: '1/x' },
];
