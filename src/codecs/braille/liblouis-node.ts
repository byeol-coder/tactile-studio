// src/codecs/braille/liblouis-node.ts
//
// A Node-native adapter for the SAME vendored liblouis engine the browser
// uses (vendor/liblouis/build-no-tables-utf32.js, asm.js, UTF-32 build) and
// the SAME 18 table files (vendor/liblouis/tables/). This is not a
// reimplementation or a mock: it loads the real asm.js build and calls the
// real `lou_translateString` C function exactly like the browser adapter
// (vendor/liblouis/braille.js) does — only the *loading* mechanism differs
// (Node fs + Function() instead of <script> injection + fetch()), because
// asm.js is plain JavaScript and Emscripten's own environment detection
// (ENVIRONMENT_IS_NODE) already supports this.
//
// Why this exists: it lets translate() be parity-tested and used from build
// tooling / Node-side rendering without a browser. The browser adapter
// (vendor/liblouis/braille.js) is untouched and keeps shipping as-is; this
// module is an additional adapter, not a replacement.
//
// Absolute rule preserved from the vendor README: translation failure NEVER
// falls back to raw text. Always { ok: false }.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = path.resolve(HERE, '..', '..', '..', 'vendor', 'liblouis');
// Emscripten's own environment detection checks `typeof require === 'function'`
// to recognize Node (see build-no-tables-utf32.js: `ENVIRONMENT_IS_NODE =
// typeof process === 'object' && typeof require === 'function' && …`). Under
// ESM, `require` isn't a global, so without this the asm.js build
// misdetects itself as a JS-shell environment (expects a global `print`) and
// throws. We inject a real `require` via node:module so detection is
// correct — this changes nothing about the translation logic itself.
const nodeRequire = createRequire(import.meta.url);

export const LANG_TABLES: Record<string, string[]> = {
  'ko-g2': ['unicode.dis', 'ko-2006-g2.ctb'],
  'ko-g1': ['unicode.dis', 'ko-2006-g1.ctb'],
  'ueb-g1': ['unicode.dis', 'en-ueb-g1.ctb'],
  'ueb-g2': ['unicode.dis', 'en-ueb-g2.ctb'],
};

const TABLE_FILES = [
  'unicode.dis', 'braille-patterns.cti', 'chardefs.cti', 'en-ueb-chardefs.uti',
  'en-ueb-g1.ctb', 'en-ueb-g2.ctb', 'en-ueb-math.ctb', 'en-us-g1.ctb', 'en-us-g2.ctb',
  'ko-2006-g1.ctb', 'ko-2006-g2.ctb', 'ko-2006.cti', 'ko-chars.cti',
  'ko-g1-rules.cti', 'ko-g2-rules.cti', 'latinLetterDef8Dots.uti',
  'litdigits6Dots.uti', 'loweredDigits6Dots.uti',
];

export interface TranslateResult {
  ok: boolean;
  unicode: string;
  cells: number;
  reason?: string;
}

// Minimal shape of the Emscripten Module we actually use — matches
// vendor/liblouis/braille.js's usage exactly.
interface LiblouisModule {
  FS: { mkdir(p: string): void; writeFile(p: string, data: Uint8Array, opts: { encoding: 'binary' }): void };
  ccall(name: string, ret: string, argTypes: string[], args: unknown[]): number;
  _malloc(n: number): number;
  _free(p: number): void;
  stringToUTF8(s: string, ptr: number, maxBytes: number): void;
  HEAP32: Int32Array;
}

let _module: LiblouisModule | null = null;
let _loadPromise: Promise<LiblouisModule> | null = null;

async function loadModule(): Promise<LiblouisModule> {
  const src = readFileSync(path.join(VENDOR_DIR, 'build-no-tables-utf32.js'), 'utf8');
  // The asm.js build is a self-contained IIFE ending in
  // `liblouisBuild = liblouisBuild();` — evaluating it and returning that
  // binding gives us the initialized Module, already synchronously run.
  // eslint-disable-next-line no-new-func
  const factory = new Function('require', `${src}\nreturn liblouisBuild;`);
  const Module = factory(nodeRequire) as LiblouisModule;
  try { Module.FS.mkdir('/tables'); } catch { /* already exists */ }
  for (const fn of TABLE_FILES) {
    const buf = readFileSync(path.join(VENDOR_DIR, 'tables', fn));
    Module.FS.writeFile(`/tables/${fn}`, new Uint8Array(buf), { encoding: 'binary' });
  }
  return Module;
}

/** Lazy-load the engine + tables (mirrors TSBraille.preload()). Idempotent;
 *  a failure resets so a later call can retry. */
export function preload(): Promise<LiblouisModule> {
  if (!_loadPromise) {
    _loadPromise = loadModule().then((m) => { _module = m; return m; }).catch((err) => {
      _loadPromise = null;
      throw err;
    });
  }
  return _loadPromise;
}

export function isReady(): boolean {
  return !!_module;
}

/** Synchronous translation via lou_translateString — verbatim port of the
 *  browser adapter's _translateSync (same buffer sizing, same ccall shape). */
function translateSync(langKey: string, text: string): TranslateResult {
  const Module = _module!;
  const tables = LANG_TABLES[langKey];
  if (!tables) return { ok: false, unicode: '', cells: 0, reason: 'unknown-lang' };
  const tlist = tables.map((t) => `/tables/${t}`).join(',');

  const codepoints = Array.from(text).map((ch) => ch.codePointAt(0) as number);
  const inlen = codepoints.length;
  if (inlen === 0) return { ok: true, unicode: '', cells: 0 };
  const maxOut = (inlen + 16) * 8;

  let inbufPtr = 0, outbufPtr = 0, inlenPtr = 0, outlenPtr = 0, tableListPtr = 0;
  try {
    inbufPtr = Module._malloc(inlen * 4);
    outbufPtr = Module._malloc(maxOut * 4);
    inlenPtr = Module._malloc(4);
    outlenPtr = Module._malloc(4);
    tableListPtr = Module._malloc(tlist.length + 1);

    for (let i = 0; i < inlen; i++) Module.HEAP32[(inbufPtr >> 2) + i] = codepoints[i];
    Module.HEAP32[inlenPtr >> 2] = inlen;
    Module.HEAP32[outlenPtr >> 2] = maxOut;
    Module.stringToUTF8(tlist, tableListPtr, tlist.length + 1);

    const ok = Module.ccall(
      'lou_translateString', 'number',
      ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
      [tableListPtr, inbufPtr, inlenPtr, outbufPtr, outlenPtr, 0, 0, 0],
    );
    if (!ok) return { ok: false, unicode: '', cells: 0, reason: 'translate-failed' };

    const outlen = Module.HEAP32[outlenPtr >> 2];
    let result = '';
    for (let i = 0; i < outlen; i++) result += String.fromCodePoint(Module.HEAP32[(outbufPtr >> 2) + i]);
    return { ok: true, unicode: result, cells: outlen };
  } catch (e) {
    return { ok: false, unicode: '', cells: 0, reason: String((e as Error)?.message || e) };
  } finally {
    if (inbufPtr) Module._free(inbufPtr);
    if (outbufPtr) Module._free(outbufPtr);
    if (inlenPtr) Module._free(inlenPtr);
    if (outlenPtr) Module._free(outlenPtr);
    if (tableListPtr) Module._free(tableListPtr);
  }
}

/** mirrors TSBraille.translate(text, langKey) — never returns raw text on failure. */
export function translate(text: string, langKey: string): TranslateResult {
  if (!_module) return { ok: false, unicode: '', cells: 0, reason: 'not-ready' };
  if (!text) return { ok: true, unicode: '', cells: 0 };
  try {
    return translateSync(langKey, text);
  } catch (e) {
    return { ok: false, unicode: '', cells: 0, reason: String((e as Error)?.message || e) };
  }
}

/** mirrors TSBraille.padOrTruncate(unicode, width) — verbatim port. */
export function padOrTruncate(unicodeCells: string, width = 20): string {
  const BRAILLE_SPACE = '\u2800';
  if (unicodeCells.length >= width) return unicodeCells.slice(0, width);
  return unicodeCells + BRAILLE_SPACE.repeat(width - unicodeCells.length);
}

/** DotPad transmission byte conversion — verbatim port of the monolith's
 *  _brailleUnicodeToHex: codepoints outside the braille block (U+2800–U+28FF)
 *  encode as 0x00, exactly like production (not an error/throw). */
export function brailleUnicodeToHex(unicodeStr: string): string {
  let hex = '';
  for (const ch of unicodeStr) {
    const cp = ch.codePointAt(0) as number;
    const byte = (cp >= 0x2800 && cp <= 0x28ff) ? cp - 0x2800 : 0;
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}
