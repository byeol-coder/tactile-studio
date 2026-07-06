#!/usr/bin/env node
// Offline DTMS → static corpus bundle for the vanilla tactile-studio.
//
// Reads the 11 curated DTMS files and emits `corpus.js` at the repo root — a
// plain, browser-loadable module that assigns `window.DTMS_CORPUS`. No server,
// no DB, no fetch (works from file://). This is the "재료 준비" step: the app
// only depends on the generated `corpus.js`, never on the raw source folder.
//
//   node scripts/build-corpus.mjs [--src <dir>] [--all]
//   DTMS_SRC=<dir> node scripts/build-corpus.mjs
//
// Growth loop: add a file to CURATED (or pass --all) and re-run.
//
// NOTE: rule-based, backendless. The extraction logic mirrors the studio
// reference ingest (a node build tool, not app runtime), producing the shape
// the vanilla runCommand search/decode reads: { id, title, lang, category,
// tags[], spec, pages:[{ page, label, graphic, desc?, braille? }] }.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../corpus.js');
const DEFAULT_SRC = '/Users/saetbyeollee/Documents/05_촉각파일_DTMS';

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const SRC = resolve(arg('--src') ?? process.env.DTMS_SRC ?? DEFAULT_SRC);
const ALL = argv.includes('--all');

/**
 * Curated mapping for the 11 samples: filename → clean title, language,
 * category, tags. Order here fixes the corpus order (deterministic output).
 * Categories follow the reference classification table.
 */
const CURATED = [
  { file: '삼국시대 영토변화.dtms',     title: '삼국시대 영토 변화', lang: 'ko', category: 'geography', tags: ['지도', '한국사', '삼국시대'] },
  { file: 'korea maps_panning.dtms',    title: '한반도',           lang: 'en', category: 'geography', tags: ['지도', '한반도', '한국사', 'korea', 'map'] },
  { file: '세포구조.dtms',              title: '세포 구조',        lang: 'ko', category: 'science',   tags: ['세포', '생물', '인체', 'cell'] },
  { file: '토성.dtms',                  title: '토성',             lang: 'ko', category: 'science',   tags: ['태양계', '행성', '천문', 'saturn'] },
  { file: '지구본.dtms',                title: '지구본',           lang: 'en', category: 'science',   tags: ['지구', '천문', '지리', 'globe', 'earth'] },
  { file: '심장 (혈관 구분).dtms',      title: '심장',             lang: 'ko', category: 'science',   tags: ['심장', '인체', '혈관', 'heart'] },
  { file: 'Pac-Man 8-bit.dtms',         title: 'Pac-Man 8-bit',    lang: 'en', category: 'basic',     tags: ['게임', '픽셀', 'game', 'pacman'] },
  { file: '촉각버전 한글자음.dtms',     title: '자음',             lang: 'ko', category: 'language',  tags: ['한글', '자음', '점자일람'] },
  { file: '[국어]문장부호.dtms',        title: '문장부호',         lang: 'ko', category: 'language',  tags: ['문장부호', '국어'] },
  { file: '[영어] 발음기호 묵자.dtms',  title: '영어 발음기호표',  lang: 'ko', category: 'language',  tags: ['발음기호', '영어', '영어발음', 'phonetic'] },
  { file: '촉각버전 한글 공부.dtms',    title: '모음',             lang: 'ko', category: 'language',  tags: ['한글', '모음', '점자일람'] },
];

// ── helpers ───────────────────────────────────────────────────────────────
/** Strip review/author noise from a raw DTMS title (fallback for --all files). */
function cleanTitle(raw) {
  return String(raw ?? '')
    .replace(/\(?검수반영\)?/g, '')      // (검수반영) / 검수반영)
    .replace(/\([^)]*\)\s*$/g, '')       // trailing "(이샛별)" author tag
    .replace(/\s+/g, ' ')
    .trim();
}

/** URL/JS-safe deterministic slug for stable ids. */
function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/\.dtms$/i, '')
    .replace(/[^a-z0-9가-힣]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

const isHex = (s) => typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length > 0;
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

/** DTMS `device` → grid spec. Every current sample is 60×40 (dotpad320). */
function specOf(device) {
  return device === 'dotpad320' ? '60x40' : '60x40';
}

/** Build a corpus record from a parsed DTMS file + its curated mapping. */
function toRecord(dtms, meta, file) {
  const pages = (dtms.items ?? []).map((it, i) => {
    // Field name `graphic` = the graphic-layer HEX (600 chars for 60×40).
    const page = { page: typeof it.page === 'number' ? it.page : i + 1, label: cleanTitle(it.title) || `${i + 1}쪽`, graphic: it.graphic?.data ?? '' };
    if (nonEmpty(it.text?.plain)) page.desc = it.text.plain.trim();
    if (isHex(it.text?.data)) page.braille = it.text.data; // braille layer preserved, not consumed by the editor
    return page;
  });
  const langRaw = String(dtms.lang ?? '').toLowerCase();
  const lang = meta?.lang ?? (langRaw.startsWith('en') ? 'en' : 'ko');
  return {
    id: `dtms-${slug(meta?.title ?? cleanTitle(dtms.title) ?? file)}`,
    title: meta?.title ?? cleanTitle(dtms.title) ?? slug(file),
    spec: specOf(dtms.device),
    lang,
    category: meta?.category ?? 'basic',
    tags: meta?.tags ?? [],
    pages,
    source: file,
  };
}

// ── select files ──────────────────────────────────────────────────────────
if (!existsSync(SRC)) {
  console.error(`✗ DTMS source folder not found: ${SRC}`);
  console.error(`  Pass --src <dir> or set DTMS_SRC.`);
  process.exit(1);
}

let entries;
if (ALL) {
  const files = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.dtms')).sort();
  const curatedByFile = new Map(CURATED.map((m) => [m.file, m]));
  entries = files.map((file) => ({ file, meta: curatedByFile.get(file) }));
} else {
  entries = CURATED.map((meta) => ({ file: meta.file, meta }));
}

// ── ingest ──────────────────────────────────────────────────────────────────
const records = [];
let skipped = 0;
for (const { file, meta } of entries) {
  const path = join(SRC, file);
  if (!existsSync(path)) {
    console.warn(`  ! skip (missing): ${file}`);
    skipped++;
    continue;
  }
  try {
    const dtms = JSON.parse(readFileSync(path, 'utf8'));
    records.push(toRecord(dtms, meta, file));
  } catch (e) {
    console.warn(`  ! skip (parse error): ${file} — ${e.message}`);
    skipped++;
  }
}

// ── emit ──────────────────────────────────────────────────────────────────
const banner = `// AUTO-GENERATED by scripts/build-corpus.mjs — DO NOT EDIT BY HAND.
// Re-run: node scripts/build-corpus.mjs  (add files to CURATED or --all to grow)
// Static, backendless corpus bundle. Loaded via <script src="./corpus.js"> so it
// works from file:// (no fetch/CORS). Read at runtime as window.DTMS_CORPUS.
`;
const body = `\nwindow.DTMS_CORPUS = ${JSON.stringify(records, null, 2)};\n`;
writeFileSync(OUT, banner + body, 'utf8');

// ── manifest ──────────────────────────────────────────────────────────────
const pageTotal = records.reduce((n, r) => n + r.pages.length, 0);
const brailleTotal = records.reduce((n, r) => n + r.pages.filter((p) => p.braille).length, 0);
console.log(`✓ Wrote ${OUT}`);
console.log(`  records: ${records.length}  pages: ${pageTotal}  braille-pages: ${brailleTotal}  skipped: ${skipped}`);
for (const r of records) {
  const b = r.pages.filter((p) => p.braille).length;
  console.log(`   · ${r.id.padEnd(26)} ${String(r.pages.length).padStart(2)}p  ${r.category.padEnd(9)} ${r.lang}  braille:${b}  "${r.title}"`);
}
