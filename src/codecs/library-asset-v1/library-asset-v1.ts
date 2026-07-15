// src/codecs/library-asset-v1/library-asset-v1.ts
//
// Verbatim port of the monolith's Library Asset v1 build/parse logic
// (buildLibraryAsset, assetPagesFromJson, _textOf, _metaOf). Schema:
// scripts/tactile-library-asset.v1.schema.json.
//
// DTMS hex encode/decode is injected (see codecs/dtms) — this module owns the
// asset-level shape (slug/id, category/lang enums, page metadata folding,
// desc/narration meta round-tripping), not the pin encoding itself.

import type { CellGrid, PageMap } from '../../core/types.js';
import { decodeDtms60x40Hex, type TwEncodeBits, encodeDtmsHex } from '../dtms/dtms.js';

// ── text/meta normalization (monolith _textOf / _metaOf) ───────────────────
// A page's braille description / narration is normally a plain string, but a
// legacy or externally-authored project JSON may carry it as a *structured*
// record (e.g. { text, lang, grade }). This resolves either shape to a
// display string while preserving any non-text fields for round-tripping.

export function textOf(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const s = o.text != null ? o.text
      : o.value != null ? o.value
      : o.content != null ? o.content
      : o.ko != null ? o.ko
      : o.label != null ? o.label : '';
    return typeof s === 'string' ? s : typeof s === 'number' ? String(s) : '';
  }
  return '';
}

/** Non-text metadata carried by a structured desc/narration value, so an
 *  export can round-trip it without loss. */
export function metaOf(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const m: Record<string, unknown> = { ...(v as Record<string, unknown>) };
    delete m.text; delete m.value; delete m.content; delete m.ko; delete m.label;
    return Object.keys(m).length ? m : null;
  }
  return null;
}

// ── build (export) ──────────────────────────────────────────────────────────

export type BanaCheckFn = (cells: CellGrid, w: number, h: number) => { pass: boolean };
export type ConvQualityFn = (cells: CellGrid, w: number, h: number) => { key: string };

export interface PageAudioEntry {
  desc?: unknown;
  descMeta?: Record<string, unknown>;
  narration?: unknown;
  narrMeta?: Record<string, unknown>;
  brl?: string;
  src?: string;
  mime?: string;
  bytes?: number;
  durationSec?: number;
}

export interface CorpusCtxPage {
  label?: string;
  desc?: string;
  braille?: string;
}

export interface CorpusCtx {
  id?: string;
  title?: string;
  pages?: CorpusCtxPage[];
  category?: string;
  tags?: string[];
}

export interface BuildLibraryAssetInput {
  name: string;
  gridW: number;
  gridH: number;
  lang: string;              // host UI language ('en' → 'en', else 'ko')
  brailleLang: string;
  activeCells: CellGrid;      // this.cells — the ACTIVE page, used for graphicFeatures
  pages: CellGrid[];          // document pages (identity order = page order)
  pageAudio: PageMap<PageAudioEntry>;
  pageVectors: PageMap<unknown[]>;
  corpusCtx: CorpusCtx | null;
}

export interface LibraryAssetV1Page {
  page: number;
  label: string;
  desc: string | Record<string, unknown>;
  braille: string;
  graphic: string;
  narration?: string | Record<string, unknown>;
  audio?: { src: string; mime: string; bytes: number; durationSec: number };
  vectorLineObjects?: unknown[];
}

export interface GraphicFeatures {
  dotpadCompatible: boolean;
  dotpadOptimized: boolean;
  embossable: boolean;
}

export interface LibraryAssetV1 {
  id: string;
  title: string;
  spec: string;
  lang: 'ko' | 'en';
  category: string;
  tags: string[];
  graphicFeatures: GraphicFeatures;
  brailleLang: string;
  pages: LibraryAssetV1Page[];
  provenance: {
    createdBy: 'tactile-studio';
    createdAt: string;
    derivedFrom: string | null;
    sourceType: 'command' | 'blank';
  };
  qa: { status: 'draft' };
  sharing: 'campus';
}

const VALID_CATEGORIES = ['science', 'language', 'geography', 'math', 'basic'];

/** monolith deriveGraphicFeatures */
export function deriveGraphicFeatures(
  cells: CellGrid, w: number, h: number,
  convQuality: ConvQualityFn, banaCheck: BanaCheckFn,
): GraphicFeatures {
  const NATIVE: Record<string, boolean> = { '60x40': true, '96x64': true, '28x40': true };
  const compatible = !!NATIVE[`${w}x${h}`];
  const q = convQuality(cells, w, h);
  const bana = banaCheck(cells, w, h);
  return { dotpadCompatible: compatible, dotpadOptimized: compatible && q.key === 'readable', embossable: bana.pass };
}

/**
 * monolith buildLibraryAsset(name). `now` and `encodeBits` are injected so
 * the result is deterministic in tests; production callers pass Date.now()
 * and the real vendor TW.encodeBits.
 */
export function buildLibraryAssetV1(
  input: BuildLibraryAssetInput,
  deps: { encodeBits: TwEncodeBits; convQuality: ConvQualityFn; banaCheck: BanaCheckFn; now: number },
): LibraryAssetV1 {
  const { name, gridW: w, gridH: h, lang, brailleLang, activeCells, pages: docPages, pageAudio, pageVectors, corpusCtx: ctx } = input;
  const hexOf = (cellBuf: CellGrid) => encodeDtmsHex(deps.encodeBits, cellBuf, w, h);
  const audioMap = pageAudio || {};
  const vectorMap = pageVectors || {};

  const pages: LibraryAssetV1Page[] = docPages.map((cellBuf, i) => {
    const a = audioMap[i];
    const page: LibraryAssetV1Page = {
      page: i + 1,
      label: (ctx?.pages?.[i]?.label) || `${name} · ${i + 1}`,
      desc: textOf(a?.desc) || (ctx?.pages?.[i]?.desc || ''),
      braille: a?.brl || (ctx?.pages?.[i]?.braille) || '',
      graphic: hexOf(cellBuf),
    };
    const narr = textOf(a?.narration);
    if (narr) page.narration = narr;
    if (a?.descMeta) page.desc = { ...a.descMeta, text: page.desc as string };
    if (a?.narrMeta && page.narration != null) page.narration = { ...a.narrMeta, text: narr };
    if (a?.src) page.audio = { src: a.src, mime: a.mime || '', bytes: a.bytes || 0, durationSec: a.durationSec || 0 };
    const v = vectorMap[i];
    if (v && v.length) page.vectorLineObjects = v;
    return page;
  });

  const slug = (name || 'asset').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '') || 'asset';
  const category = (ctx && VALID_CATEGORIES.includes(ctx.category || '')) ? (ctx!.category as string) : 'basic';

  return {
    id: `lib-${slug}-${deps.now.toString(36)}`,
    title: name,
    spec: `${w}x${h}`,
    lang: lang === 'en' ? 'en' : 'ko',
    category,
    tags: Array.isArray(ctx?.tags) ? ctx!.tags!.slice() : [],
    graphicFeatures: deriveGraphicFeatures(activeCells, w, h, deps.convQuality, deps.banaCheck),
    brailleLang,
    pages,
    provenance: {
      createdBy: 'tactile-studio',
      createdAt: new Date(deps.now).toISOString(),
      derivedFrom: ctx && ctx.id ? ctx.id : null,
      sourceType: ctx ? 'command' : 'blank',
    },
    qa: { status: 'draft' },
    sharing: 'campus',
  };
}

// ── parse (import) ──────────────────────────────────────────────────────────

export interface ParsedAssetPage {
  cells: CellGrid;
  label?: string;
  desc?: unknown;
  narration?: unknown;
}

export interface ParsedAsset {
  title: string;
  pages: ParsedAssetPage[];
}

/**
 * monolith assetPagesFromJson(obj). Accepts either:
 *  - schema-v1 / corpus record shape: pages[].graphic (or legacy .data)
 *  - raw DTMS export shape: items[].graphic.data
 * Returns null when neither shape matches or no page decodes successfully.
 * `decodeHex` is injected (defaults to the 60×40 decoder) so this stays a
 * pure orchestration layer over the codec, not a duplicate of it.
 */
export function parseLibraryAssetPages(
  obj: any,
  decodeHex: (hex: unknown) => CellGrid | null = decodeDtms60x40Hex,
): ParsedAsset | null {
  if (!obj || typeof obj !== 'object') return null;
  let raw: Array<{ hex: unknown; label?: string; desc?: unknown; narration?: unknown }> | null = null;
  if (Array.isArray(obj.pages)) {
    raw = obj.pages.map((p: any) => ({ hex: p.graphic || p.data, label: p.label, desc: p.desc, narration: p.narration }));
  } else if (Array.isArray(obj.items)) {
    raw = obj.items.map((it: any, i: number) => ({ hex: it.graphic && it.graphic.data, label: it.title || `${i + 1}쪽` }));
  }
  if (!raw) return null;
  const pages: ParsedAssetPage[] = [];
  for (const r of raw) {
    const cells = decodeHex(r.hex);
    if (cells) pages.push({ cells, label: r.label, desc: r.desc, narration: r.narration });
  }
  return pages.length ? { title: obj.title || '', pages } : null;
}
