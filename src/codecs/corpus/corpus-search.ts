// src/codecs/corpus/corpus-search.ts
//
// Verbatim port of corpus-search.js — a deterministic, rule-based search
// over the static corpus bundle (no ML, no fetch, no Date/random). The only
// change from the shipped module: `corpus` is an explicit parameter instead
// of being read from `window.DTMS_CORPUS` via a global getter, so this
// module has zero DOM/global dependency and can run anywhere (Node, tests,
// a future non-browser host). All scoring weights, tie-breaking rules,
// aliases, and synonyms are copied exactly — do not "tune" them here; if the
// shipped corpus-search.js changes, re-port from it.

import type { CorpusRecord, CorpusPage, CorpusSearchOptions, CorpusSearchResult, CorpusFeatureCounts } from './types.js';

const DEFAULT_LIMIT = 8;
const NEAR_LIMIT = 4;

/** lowercase (English only; Korean is case-invariant), fold common
 *  separators/punctuation to spaces, collapse + trim whitespace. */
export function normalizeCorpusQuery(value: unknown): string {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[·.,/\\_()[\]{}!?"'“”‘’:;]+/g, ' ')
    .replace(/[-–—−]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const norm = normalizeCorpusQuery;

function tokenize(q: string): string[] {
  if (!q) return [];
  return q.split(' ').map((t) => t.trim()).filter((t) => t.length >= 2);
}

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  science: ['science', '과학', '생물', '천문', '인체', 'biology', 'astronomy'],
  language: ['language', '언어', '국어', '영어', '한글', '점자', 'korean', 'english'],
  geography: ['geography', '지리', '지도', '역사', 'history', 'map'],
  basic: ['basic', '기타', '게임', 'game', 'etc'],
};

const QUERY_ALIASES: Record<string, string[]> = {
  '팩맨': ['pacman'], 'pac man': ['pacman'],
  planet: ['행성'], planets: ['행성'],
  space: ['천문'], '우주': ['천문'],
  alphabet: ['영어', '발음기호'], abc: ['영어', '발음기호'], '알파벳': ['영어', '발음기호'],
};

function expandQuery(q: string, tokens: string[]): string[] {
  const out = tokens.slice();
  const seen: Record<string, 1> = {};
  out.forEach((t) => { seen[t] = 1; });
  const padded = ` ${q} `;
  for (const key of Object.keys(QUERY_ALIASES)) {
    if (padded.indexOf(` ${key} `) === -1) continue;
    for (const tk of QUERY_ALIASES[key]) {
      if (!seen[tk]) { seen[tk] = 1; out.push(tk); }
    }
  }
  return out;
}

function includesEither(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}

const FIELD_RANK = ['title-exact', 'tag-exact', 'category', 'title', 'tag', 'page-label', 'desc', 'braille'];
function primaryField(fields: string[]): string {
  for (const f of FIELD_RANK) if (fields.indexOf(f) !== -1) return f;
  return fields[0] || 'none';
}

const CONFIDENT_FIELDS = ['title-exact', 'tag-exact', 'category', 'title', 'tag'];
function isConfident(fields: string[]): boolean {
  for (const f of fields) if (CONFIDENT_FIELDS.indexOf(f) !== -1) return true;
  return false;
}

interface ScoreResult { score: number; fields: string[] }

function scorePage(page: CorpusPage | undefined, q: string, tokens: string[]): ScoreResult {
  const label = norm(page && page.label);
  const desc = norm(page && page.desc);
  const brailleRaw = String((page && page.braille) || '');
  const brailleText = norm(brailleRaw);
  const brailleHex = brailleRaw.toLowerCase();
  let score = 0;
  const fields: string[] = [];
  if (q && label && label.indexOf(q) !== -1) { score += 20; fields.push('page-label'); }
  for (const t of tokens) {
    if (label && label.indexOf(t) !== -1) { score += 12; if (fields.indexOf('page-label') === -1) fields.push('page-label'); }
    if (desc && desc.indexOf(t) !== -1) { score += 6; if (fields.indexOf('desc') === -1) fields.push('desc'); }
    if (brailleText && brailleText.indexOf(t) !== -1) {
      score += 3; if (fields.indexOf('braille') === -1) fields.push('braille');
    } else if (brailleHex && t.length >= 3 && /^[0-9a-f]+$/.test(t) && brailleHex.indexOf(t) !== -1) {
      score += 1; if (fields.indexOf('braille') === -1) fields.push('braille');
    }
  }
  return { score, fields };
}

interface BestPageResult { index: number; score: number; fields: string[] }

function bestPage(graphic: CorpusRecord, q: string, tokens: string[]): BestPageResult {
  const pages = graphic?.pages || [];
  let bestIdx = 0, best: ScoreResult = { score: 0, fields: [] };
  for (let i = 0; i < pages.length; i++) {
    const ps = scorePage(pages[i], q, tokens);
    if (ps.score > best.score) { best = ps; bestIdx = i; }
  }
  return { index: bestIdx, score: best.score, fields: best.fields };
}

interface RecordScoreResult { score: number; fields: string[]; matchedTags: string[]; pageIndex: number }

function scoreRecord(graphic: CorpusRecord, q: string, tokens: string[]): RecordScoreResult {
  const title = norm(graphic.title);
  const tags = (graphic.tags || []).map(norm);
  const syn = (CATEGORY_SYNONYMS[graphic.category] || []).map(norm);
  const category = norm(graphic.category);
  let score = 0;
  const fields: string[] = [];
  const matchedTags: string[] = [];

  if (q && title === q) { score += 200; fields.push('title-exact'); }
  else if (q && title.indexOf(q) !== -1) { score += 100; fields.push('title'); }
  if (q && tags.indexOf(q) !== -1) { score += 120; fields.push('tag-exact'); }
  if (q && (category === q || syn.indexOf(q) !== -1)) { score += 90; fields.push('category'); }
  else if (q && (includesEither(category, q) || syn.some((s) => includesEither(s, q)))) {
    score += 80; fields.push('category');
  }

  for (const t of tokens) {
    if (title.indexOf(t) !== -1) { score += 25; if (fields.indexOf('title') === -1 && fields.indexOf('title-exact') === -1) fields.push('title'); }
    for (let j = 0; j < tags.length; j++) {
      const tag = tags[j];
      if (tag === t) { score += 40; matchedTags.push(graphic.tags[j]); if (fields.indexOf('tag') === -1 && fields.indexOf('tag-exact') === -1) fields.push('tag'); }
      else if (includesEither(tag, t)) { score += 18; matchedTags.push(graphic.tags[j]); if (fields.indexOf('tag') === -1 && fields.indexOf('tag-exact') === -1) fields.push('tag'); }
    }
    for (const s of syn) {
      if (includesEither(s, t)) { score += 8; if (fields.indexOf('category') === -1) fields.push('category'); break; }
    }
  }

  if (q && tags.indexOf(q) !== -1) {
    const qi = tags.indexOf(q);
    if (matchedTags.indexOf(graphic.tags[qi]) === -1) matchedTags.push(graphic.tags[qi]);
  }

  const bp = bestPage(graphic, q, tokens);
  score += bp.score;
  for (const f of bp.fields) if (fields.indexOf(f) === -1) fields.push(f);

  const seen: Record<string, 1> = {};
  const uniqTags: string[] = [];
  for (const m of matchedTags) if (!seen[m]) { seen[m] = 1; uniqTags.push(m); }

  return { score, fields, matchedTags: uniqTags, pageIndex: bp.index };
}

function toResult(graphic: CorpusRecord, s: { score: number; fields: string[]; matchedTags: string[]; pageIndex: number }): CorpusSearchResult {
  const pages = graphic.pages || [];
  const page = pages[s.pageIndex] || pages[0] || ({} as CorpusPage);
  const graphicHex = page.graphic || page.data || '';
  return {
    id: graphic.id,
    title: graphic.title,
    category: graphic.category,
    lang: graphic.lang,
    spec: graphic.spec,
    graphicFeatures: graphic.graphicFeatures || null,
    matchedTags: s.matchedTags,
    pageIndex: s.pageIndex,
    pageNumber: typeof page.page === 'number' ? page.page : s.pageIndex + 1,
    pageCount: pages.length,
    pageLabel: page.label || '',
    graphic: graphicHex,
    score: s.score,
    confident: isConfident(s.fields),
    reason: primaryField(s.fields),
    matchedFields: s.fields,
  };
}

function recordHasFeatures(rec: CorpusRecord, features: string[]): boolean {
  if (!features || !features.length) return true;
  const gf = rec && rec.graphicFeatures;
  if (!gf) return false;
  for (const f of features) if (!(gf as Record<string, unknown>)[f]) return false;
  return true;
}

/** monolith window.searchCorpus(query, options) — ranked direct hits. */
export function searchCorpus(corpus: CorpusRecord[], query: unknown, options: CorpusSearchOptions = {}): CorpusSearchResult[] {
  const limit = typeof options.limit === 'number' ? options.limit : DEFAULT_LIMIT;
  const minScore = typeof options.minScore === 'number' ? options.minScore : 1;
  const features = Array.isArray(options.features) ? options.features : [];
  const q = norm(query);
  if (!q) return [];
  const tokens = expandQuery(q, tokenize(q));
  const scored: Array<{ order: number; result: CorpusSearchResult }> = [];
  for (let i = 0; i < corpus.length; i++) {
    if (!recordHasFeatures(corpus[i], features)) continue;
    const s = scoreRecord(corpus[i], q, tokens);
    if (s.score >= minScore) scored.push({ order: i, result: toResult(corpus[i], s) });
  }
  scored.sort((a, b) => (b.result.score !== a.result.score ? b.result.score - a.result.score : a.order - b.order));
  return scored.slice(0, limit).map((x) => x.result);
}

/** monolith window.corpusFeatureCounts() — TGIL-style filter counts. */
export function featureCounts(corpus: CorpusRecord[]): CorpusFeatureCounts {
  const out: CorpusFeatureCounts = { dotpadCompatible: 0, dotpadOptimized: 0, embossable: 0, total: corpus.length };
  for (const rec of corpus) {
    const gf = rec && rec.graphicFeatures; if (!gf) continue;
    if (gf.dotpadCompatible) out.dotpadCompatible++;
    if (gf.dotpadOptimized) out.dotpadOptimized++;
    if (gf.embossable) out.embossable++;
  }
  return out;
}

function isNearToken(a: string, b: string): boolean {
  if (!a || !b || a.length < 3 || b.length < 3) return false;
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  let pre = 0;
  while (pre < n && a.charAt(pre) === b.charAt(pre)) pre++;
  return pre >= 3;
}

function looseHaystackTokens(graphic: CorpusRecord): string[] {
  const strings = [norm(graphic.title)]
    .concat((graphic.tags || []).map(norm))
    .concat((CATEGORY_SYNONYMS[graphic.category] || []).map(norm))
    .concat((graphic.pages || []).map((p) => norm(p.label)))
    .concat((graphic.pages || []).map((p) => norm(p.desc)))
    .filter(Boolean);
  const seen: Record<string, 1> = {};
  const out: string[] = [];
  for (const s of strings) {
    for (const part of tokenize(s)) if (!seen[part]) { seen[part] = 1; out.push(part); }
  }
  return out;
}

function scoreLoose(graphic: CorpusRecord, tokens: string[]): number {
  const hay = looseHaystackTokens(graphic);
  let score = 0;
  for (const t of tokens) {
    if (t.length < 2) continue;
    for (const h of hay) {
      if (h === t) { score += 4; break; }
      if (h.length >= 2 && includesEither(h, t)) { score += 3; break; }
      if (isNearToken(t, h)) { score += 2; break; }
    }
  }
  return score;
}

/** monolith window.nearMatches(query, options) — looser suggestions (miss path). */
export function nearMatches(corpus: CorpusRecord[], query: unknown, options: CorpusSearchOptions = {}): CorpusSearchResult[] {
  const limit = typeof options.limit === 'number' ? options.limit : NEAR_LIMIT;
  const q = norm(query);
  if (!q) return [];
  const tokens = expandQuery(q, tokenize(q));
  const confident: Record<string, true> = {};
  searchCorpus(corpus, query, { limit: 100 }).forEach((r) => { if (r.confident) confident[r.id] = true; });
  const scored: Array<{ order: number; result: CorpusSearchResult }> = [];
  for (let i = 0; i < corpus.length; i++) {
    if (confident[corpus[i].id]) continue;
    const sc = scoreLoose(corpus[i], tokens);
    if (sc > 0) {
      const bp = bestPage(corpus[i], q, tokens);
      scored.push({ order: i, result: toResult(corpus[i], { score: sc, fields: ['near'], matchedTags: [], pageIndex: bp.index }) });
    }
  }
  scored.sort((a, b) => (b.result.score !== a.result.score ? b.result.score - a.result.score : a.order - b.order));
  return scored.slice(0, limit).map((x) => x.result);
}
