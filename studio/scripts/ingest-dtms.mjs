#!/usr/bin/env node
// Offline DTMS → bundled corpus ingest (backendless).
//
// Reads DTMS files, extracts the channels Studio + a future viewer need
// (graphic HEX, braille HEX, plain text, audio reference), applies a curated
// title/category/tag mapping, and writes a compact, typed, DETERMINISTIC data
// module at src/corpus/dtmsCorpus.generated.ts.
//
// This replaces the task's Supabase ingest: no DB, no Storage, no upload. The
// growth loop is "add a file to CURATED (or pass --all) and re-run".
//
//   node scripts/ingest-dtms.mjs [--src <dir>] [--all]
//   DTMS_SRC=<dir> node scripts/ingest-dtms.mjs
//
// The raw .dtms files stay outside the repo; only the compact generated module
// is committed, so the app never depends on the source folder at runtime.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/corpus/dtmsCorpus.generated.ts');
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
 * Curated mapping for the task's 11 samples: filename → clean title, language,
 * category, tags. Order here fixes the corpus order (deterministic output).
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

/** DTMS `device` → studio resolution spec. */
function specOf(device) {
  if (device === 'dotpad320') return '60x40';
  return '60x40'; // only spec present across all samples
}

/** Build a CorpusGraphic record from a parsed DTMS file + its mapping entry. */
function toRecord(dtms, meta, file) {
  const pages = (dtms.items ?? []).map((it, i) => {
    const page = { page: typeof it.page === 'number' ? it.page : i + 1, label: cleanTitle(it.title) || `${i + 1}쪽`, data: it.graphic?.data ?? '' };
    if (nonEmpty(it.text?.plain)) page.desc = it.text.plain.trim();
    if (isHex(it.text?.data)) page.braille = it.text.data;
    // Audio reference only (path/filename) — never a payload.
    const audioRef = nonEmpty(it.audio?.fileName) ? it.audio.fileName : nonEmpty(dtms.audioPath) ? dtms.audioPath : '';
    if (nonEmpty(audioRef)) page.audio = audioRef.trim();
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
const banner = `// AUTO-GENERATED by scripts/ingest-dtms.mjs — DO NOT EDIT BY HAND.
// Re-run: node scripts/ingest-dtms.mjs  (add files or --all to grow the corpus)
import type { CorpusGraphic } from './types';
`;
const body = `\nexport const DTMS_CORPUS: CorpusGraphic[] = ${JSON.stringify(records, null, 2)};\n`;
writeFileSync(OUT, banner + body, 'utf8');

// ── manifest ──────────────────────────────────────────────────────────────
const pageTotal = records.reduce((n, r) => n + r.pages.length, 0);
const brailleTotal = records.reduce((n, r) => n + r.pages.filter((p) => p.braille).length, 0);
const audioTotal = records.reduce((n, r) => n + r.pages.filter((p) => p.audio).length, 0);
console.log(`✓ Wrote ${OUT}`);
console.log(`  records: ${records.length}  pages: ${pageTotal}  braille-pages: ${brailleTotal}  audio-pages: ${audioTotal}  skipped: ${skipped}`);
for (const r of records) {
  const b = r.pages.filter((p) => p.braille).length;
  console.log(`   · ${r.id.padEnd(28)} ${String(r.pages.length).padStart(2)}p  ${r.category.padEnd(9)} ${r.lang}  braille:${b}  "${r.title}"`);
}
