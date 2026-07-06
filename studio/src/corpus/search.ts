import type { TactileDocument } from '../types/tactile';
import type { Language } from '../i18n/messages';
import { parseTactileLayer } from '../integration/tactileLayer';
import { createEmptyGrid, computeQuality } from '../utils/tactileGrid';
import { getCorpus } from './index';
import type { CorpusCategory, CorpusGraphic } from './types';

/**
 * Rule-based corpus search (spec B1 — NO embeddings / ML). A command prompt is
 * normalized (KO/EN, lowercase, collapsed spaces) and matched against each
 * graphic's title (ilike), tags (contains), and category (with a few bilingual
 * synonyms). Hits are ranked by match strength; a looser near-match pass feeds
 * the miss path (spec B5) so the UI never shows a bare "no results".
 */

export interface CorpusHit {
  graphic: CorpusGraphic;
  score: number;
}

const DEFAULT_LIMIT = 8;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Split a normalized query into meaningful tokens (drops 1-char noise). */
function tokenize(q: string): string[] {
  return q
    .split(/[\s,·./-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** Bilingual keyword hints that point at a category (recall aid, not ML). */
const CATEGORY_SYNONYMS: Record<CorpusCategory, string[]> = {
  science: ['science', '과학', '생물', '천문', '인체', 'biology', 'astronomy'],
  language: ['language', '언어', '국어', '영어', '한글', '점자', 'korean', 'english'],
  geography: ['geography', '지리', '지도', '역사', 'history', 'map'],
  basic: ['basic', '기타', '게임', 'game', 'etc'],
};

/** Strict relevance score for a graphic against a query. 0 = no match. */
function scoreStrict(g: CorpusGraphic, q: string, tokens: string[]): number {
  const title = norm(g.title);
  const tags = g.tags.map(norm);
  let score = 0;

  if (q && title.includes(q)) score += 100; // whole-query title match
  for (const t of tokens) {
    if (title.includes(t)) score += 25;
    if (tags.some((tag) => tag.includes(t) || t.includes(tag))) score += 18;
  }
  // Category hit via bilingual synonyms present in the query.
  if (CATEGORY_SYNONYMS[g.category].some((kw) => q.includes(norm(kw)))) score += 8;
  return score;
}

/**
 * Looser score for near-matches — also scans per-page labels/desc, where the
 * bulk of a multi-page graphic's content lives (title/tags alone miss "고구려",
 * "가야", etc.). Recall aid for the miss path only, not the primary search.
 */
function scoreLoose(g: CorpusGraphic, tokens: string[]): number {
  const hay = [
    norm(g.title),
    ...g.tags.map(norm),
    ...CATEGORY_SYNONYMS[g.category].map(norm),
    ...g.pages.map((p) => norm(p.label)),
    ...g.pages.map((p) => norm(p.desc ?? '')),
  ].filter(Boolean);
  let score = 0;
  for (const t of tokens) {
    for (const h of hay) {
      if (h.includes(t) || t.includes(h)) {
        score += 1;
        break;
      }
    }
  }
  return score;
}

/**
 * Search the corpus for a prompt. Returns strict hits (title/tag/category),
 * highest score first, capped at `limit`.
 */
export function searchCorpus(query: string, _lang: Language = 'ko', limit = DEFAULT_LIMIT): CorpusHit[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = tokenize(q);
  return getCorpus()
    .map((graphic) => ({ graphic, score: scoreStrict(graphic, q, tokens) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Near candidates for the miss path (spec B5): looser partial matches, excluding
 * anything already returned as a strict hit. May be empty (then the caller falls
 * back to the generator + image-conversion hint).
 */
export function nearMatches(query: string, lang: Language = 'ko', limit = 4): CorpusHit[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = tokenize(q);
  const strict = new Set(searchCorpus(query, lang).map((h) => h.graphic.id));
  return getCorpus()
    .filter((g) => !strict.has(g.id))
    .map((graphic) => ({ graphic, score: scoreLoose(graphic, tokens) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Decode one page's graphic layer (HEX) into an editable {@link TactileDocument}
 * — the studio analog of `setSpec → parseSpec → decodePins`. Reuses the proven
 * {@link parseTactileLayer} codec at the graphic's own spec. `braille`/`audio`
 * are intentionally ignored (graphic layer only); they stay in the corpus.
 */
export function corpusPageToDocument(
  graphic: CorpusGraphic,
  pageIndex: number,
  _lang: Language = 'ko',
): TactileDocument {
  const page = graphic.pages[pageIndex] ?? graphic.pages[0];
  // Multi-page: show a distinct page label, else fall back to the page number
  // (avoids "title · title" when the DTMS page label repeats the file title).
  const rawLabel = page?.label?.trim();
  const pageName = rawLabel && rawLabel !== graphic.title ? rawLabel : `${page?.page ?? pageIndex + 1}쪽`;
  const label = graphic.pages.length > 1 ? `${graphic.title} · ${pageName}` : graphic.title;
  const doc = parseTactileLayer({ resolution: graphic.spec, hex: page?.data ?? '', title: label });
  if (doc) return doc;
  // Structurally unusable hex → safe empty grid at the declared spec.
  const now = new Date().toISOString();
  const cells = createEmptyGrid(graphic.spec);
  return {
    id: `doc-corpus-${graphic.id}-${pageIndex}`,
    title: label,
    resolution: graphic.spec,
    cells,
    quality: computeQuality(cells, graphic.spec),
    createdAt: now,
    updatedAt: now,
  };
}
