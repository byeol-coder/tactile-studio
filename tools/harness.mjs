// tools/harness.mjs
// Phase 1 regression harness.
//
// Loads the *actual shipped source* (index.html's single text/x-dc script
// block and vendor/tw/pins.js / corpus.js) inside a node:vm sandbox so that
// regression tests exercise the real production code paths byte-for-byte —
// no reimplementation, no transpile step, no behavior change.
//
// Compatibility-critical invariants exercised through this harness:
//   dotBit = lx * 4 + ly     (2×4 cell packing, EA column-first CELL order)
//   600-hex 60×40 output     (TW.encodeBits / corpusCellsFromHex)
//   96×64 output             (dotpad768 spec)
// Do NOT "fix" or normalize anything here; the harness must stay a
// pass-through to the shipped implementation.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readRepoFile(rel) {
  return readFileSync(path.join(ROOT, rel), 'utf8');
}

// ── x-dc extraction ──────────────────────────────────────────────────────────
// index.html must contain exactly ONE text/x-dc script block (the app logic).
export function extractXdcSource(html = readRepoFile('index.html')) {
  const open = /<script type="text\/x-dc"[^>]*>/g;
  const matches = [...html.matchAll(open)];
  if (matches.length !== 1) {
    throw new Error(`expected exactly 1 text/x-dc block, found ${matches.length}`);
  }
  const start = matches[0].index + matches[0][0].length;
  const end = html.indexOf('</script>', start);
  if (end < 0) throw new Error('unterminated text/x-dc block');
  return html.slice(start, end);
}

// ── sandbox helpers ──────────────────────────────────────────────────────────
function makeWindowContext(extra = {}) {
  const windowObj = {};
  const ctx = {
    window: windowObj,
    console,
    URL,
    Blob: globalThis.Blob,
    Uint8Array,
    Array,
    JSON,
    Math,
    Date,
    parseInt,
    parseFloat,
    isFinite,
    isNaN,
    String,
    Number,
    Object,
    RegExp,
    Error,
    setTimeout,
    clearTimeout,
    ...extra,
  };
  ctx.globalThis = ctx;
  windowObj.window = windowObj;
  return vm.createContext(ctx);
}

// Load vendor/tw/pins.js and return its window.TW export surface.
export function loadVendorTW() {
  const ctx = makeWindowContext();
  vm.runInContext(readRepoFile('vendor/tw/pins.js'), ctx, { filename: 'vendor/tw/pins.js' });
  return ctx.window.TW;
}

// Load corpus.js and return window.DTMS_CORPUS (read-only static bundle).
export function loadCorpus() {
  const ctx = makeWindowContext();
  vm.runInContext(readRepoFile('corpus.js'), ctx, { filename: 'corpus.js' });
  return ctx.window.DTMS_CORPUS;
}

// ── x-dc Component class loading ─────────────────────────────────────────────
// The x-dc block declares `class Component extends DCLogic { … }`.
// We provide a minimal DCLogic base so the class can be *defined* (methods are
// taken from the prototype; the constructor is never run by the harness).
// `fixedNow` freezes Date inside the sandbox so methods that stamp timestamps
// (e.g. buildLibraryAsset) become deterministic for fixtures.
/**
 * @param {{ fixedNow?: number | null, tw?: any, localStorage?: any }} [opts]
 */
export function loadStudioClass({ fixedNow = null, tw = null, localStorage = null } = {}) {
  const source = extractXdcSource();
  const FixedDate = fixedNow == null ? Date : class extends Date {
    constructor(...args) { args.length ? super(...args) : super(fixedNow); }
    static now() { return fixedNow; }
  };
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state) : patch;
      Object.assign(this.state, next);
    }
    T() { return {}; }
  }
  const ctx = makeWindowContext({ DCLogic, Date: FixedDate });
  if (tw) ctx.window.TW = tw;
  // The class body is compiled+run INSIDE this vm context, so any free
  // reference to `window` inside its methods (e.g. saveLibrary/loadLibrary)
  // resolves through ctx.window forever — setting globalThis.window in the
  // calling test has no effect on it. Storage-adapter parity tests must
  // inject their fake localStorage here, not on the real global.
  if (localStorage) ctx.window.localStorage = localStorage;
  const Component = vm.runInContext(`${source}\n;Component;`, ctx, { filename: 'index.html#x-dc' });
  return { Component, context: ctx };
}

// Build a detached instance carrying only the state a target method needs.
// (Object.create keeps the real prototype chain; no constructor side effects.)
export function makeInstance(Component, fields = {}) {
  const inst = Object.create(Component.prototype);
  inst.props = {};
  inst.state = {};
  Object.assign(inst, fields);
  return inst;
}

// ── deterministic pattern generators (seeded, no RNG state leakage) ─────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededCells(w, h, seed, density = 0.35) {
  const rnd = mulberry32(seed);
  const cells = new Uint8Array(w * h);
  for (let i = 0; i < cells.length; i++) cells[i] = rnd() < density ? 1 : 0;
  return cells;
}

export function patternCells(w, h, kind) {
  const cells = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let on = 0;
    if (kind === 'all-on') on = 1;
    else if (kind === 'all-off') on = 0;
    else if (kind === 'checker') on = (x + y) % 2;
    else if (kind === 'first-row') on = y === 0 ? 1 : 0;
    else if (kind === 'first-col') on = x === 0 ? 1 : 0;
    else if (kind === 'diagonal') on = x === y ? 1 : 0;
    cells[y * w + x] = on;
  }
  return cells;
}

// flat Uint8Array(w*h) → bits[row][col] (same shape Component.cellsToBits emits)
export function cellsToBitsPlain(cells, w, h) {
  const bits = new Array(h);
  for (let y = 0; y < h; y++) {
    const row = new Array(w);
    for (let x = 0; x < w; x++) row[x] = !!cells[y * w + x];
    bits[y] = row;
  }
  return bits;
}

// ── live-ish instance for parity tests (Phase 2) ────────────────────────────
// Builds a Component instance carrying real editor state (pages/cells/maps)
// with UI side effects neutralized: T() yields callable-empty i18n entries,
// preview/braille queues are no-ops. Core logic under test is untouched.
export function makeLiveInstance(Component, { gridW = 60, gridH = 40, pages = null, pageIndex = 0 } = {}) {
  const inst = Object.create(Component.prototype);
  inst.props = {};
  inst.state = { gridW, gridH, pageIndex, pageCount: pages ? pages.length : 1, corpusCtx: null };
  inst.setState = (patch) => {
    const next = typeof patch === 'function' ? patch(inst.state) : patch;
    Object.assign(inst.state, next);
  };
  inst.T = () => new Proxy({}, { get: () => (..._a) => '' });
  inst.say = () => {};
  inst.queueLivePreview = () => {};
  inst.queueBraillePreview = () => {};
  inst.pages = pages || [new Uint8Array(gridW * gridH)];
  inst.cells = inst.pages[pageIndex];
  inst.pageAudio = {};
  inst.pageVectors = {};
  inst.undoStack = [];
  inst.redoStack = [];
  inst.polyPts = [];
  inst.preview = null;
  return inst;
}
