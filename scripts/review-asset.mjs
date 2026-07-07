#!/usr/bin/env node
// review-asset.mjs — QA review gate for Tactile Library Assets (schema v1).
//
// The corpus is the CANONICAL library: build-corpus only ships assets with
// qa.status='approved' AND sharing='community'. This tool is the reviewer's
// side of that gate — inspect a draft, then promote or reject it. Reviewers
// work on the asset .json files directly (not in Studio), so a creator can't
// self-approve their own work.
//
// Usage:
//   node scripts/review-asset.mjs list   <dir>
//   node scripts/review-asset.mjs show   <file>
//   node scripts/review-asset.mjs approve <file> --reviewer "심영훈" [--score 82] [--to-community]
//   node scripts/review-asset.mjs reject  <file> --reviewer "심영훈" [--note "점 밀도 과다"]
//   node scripts/review-asset.mjs review  <file> --reviewer "심영훈"   (→ in_review)
//
// A minimum quality bar (qa.qualityScore) is enforced on approve: default 60,
// override with --min. Approve also warns (does not block) if sharing isn't
// 'community', since only community assets reach the corpus.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const cmd = argv[0];
const target = argv[1];
const flag = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
};
const has = (name) => argv.includes(name);

const MIN_SCORE = Number(flag('--min') ?? 60);
const STATUSES = ['draft', 'in_review', 'approved', 'rejected'];

function die(msg) { console.error('✗ ' + msg); process.exit(1); }
function readAsset(file) {
  if (!existsSync(file)) die(`file not found: ${file}`);
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { die(`parse error: ${file} — ${e.message}`); }
}
function writeAsset(file, a) { writeFileSync(file, JSON.stringify(a, null, 2) + '\n', 'utf8'); }
function statusOf(a) { return (a.qa && a.qa.status) || 'draft'; }
function ensureQa(a) { if (!a.qa || typeof a.qa !== 'object') a.qa = { status: 'draft' }; return a.qa; }
function eligible(a) { return statusOf(a) === 'approved' && (a.sharing || 'private') === 'community'; }

function listDir(dir) {
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) die(`dir not found: ${dir}`);
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort();
  if (!files.length) { console.log('(no .json assets in ' + dir + ')'); return; }
  const counts = { draft: 0, in_review: 0, approved: 0, rejected: 0 };
  console.log(`Assets in ${dir}:`);
  for (const f of files) {
    let a; try { a = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { console.log(`  ? ${f.padEnd(34)} (parse error)`); continue; }
    const st = statusOf(a); counts[st] = (counts[st] || 0) + 1;
    const gate = eligible(a) ? '→ corpus ✓' : '(held)';
    const score = a.qa && typeof a.qa.qualityScore === 'number' ? `score:${a.qa.qualityScore}` : 'score:—';
    console.log(`  ${st.padEnd(9)} ${String(a.sharing || 'private').padEnd(9)} ${score.padEnd(10)} ${gate.padEnd(11)} ${f}  "${a.title || ''}"`);
  }
  console.log(`\n  totals: draft ${counts.draft} · in_review ${counts.in_review} · approved ${counts.approved} · rejected ${counts.rejected}`);
  console.log(`  (corpus ships only: qa.status=approved AND sharing=community)`);
}

function show(file) {
  const a = readAsset(file);
  const pages = Array.isArray(a.pages) ? a.pages : [];
  console.log(`title:    ${a.title || '(none)'}  [${a.id || 'no-id'}]`);
  console.log(`spec/lang:${a.spec || '?'} / ${a.lang || '?'}   category:${a.category || '?'}   tags:${(a.tags || []).join(', ') || '(none)'}`);
  console.log(`sharing:  ${a.sharing || 'private'}`);
  console.log(`qa:       status=${statusOf(a)}  score=${a.qa && a.qa.qualityScore != null ? a.qa.qualityScore : '—'}  reviewer=${a.qa && a.qa.reviewer || '—'}  reviewedAt=${a.qa && a.qa.reviewedAt || '—'}`);
  if (a.qa && a.qa.teacherFeedback) console.log(`feedback: ${a.qa.teacherFeedback}`);
  console.log(`pages:    ${pages.length}`);
  const withAudio = pages.filter((p) => p.audio && p.audio.src).length;
  const withNarr = pages.filter((p) => p.narration).length;
  console.log(`          audio:${withAudio}  narration:${withNarr}`);
  console.log(`eligible for corpus: ${eligible(a) ? 'YES' : 'no — ' + (statusOf(a) !== 'approved' ? 'not approved' : 'not community')}`);
}

function setStatus(file, next, { reviewer, score, note, toCommunity } = {}) {
  const a = readAsset(file);
  const qa = ensureQa(a);
  if (next === 'approved') {
    const s = score != null ? Number(score) : (typeof qa.qualityScore === 'number' ? qa.qualityScore : undefined);
    if (s == null || Number.isNaN(s)) die(`approve needs a quality score: pass --score <0-100> (min ${MIN_SCORE})`);
    if (s < MIN_SCORE) die(`quality score ${s} is below the minimum bar ${MIN_SCORE} — refine or lower --min deliberately`);
    qa.qualityScore = s;
    if (!reviewer) die('approve/reject require --reviewer "<name>"');
  }
  if ((next === 'approved' || next === 'rejected' || next === 'in_review') && !reviewer) die(`${next} requires --reviewer "<name>"`);
  qa.status = next;
  if (reviewer) qa.reviewer = reviewer;
  qa.reviewedAt = new Date().toISOString();
  if (note) qa.teacherFeedback = note;
  if (toCommunity) a.sharing = 'community';
  writeAsset(file, a);
  console.log(`✓ ${file} → qa.status=${next}${reviewer ? '  reviewer=' + reviewer : ''}${next === 'approved' ? '  score=' + qa.qualityScore : ''}`);
  if (next === 'approved' && (a.sharing || 'private') !== 'community') {
    console.log(`  ⚠ sharing=${a.sharing || 'private'} — asset is approved but will NOT reach the corpus until sharing=community (use --to-community).`);
  }
  if (eligible(a)) console.log(`  → now eligible for corpus (re-run build-corpus --all).`);
}

switch (cmd) {
  case 'list': listDir(resolve(target || '.')); break;
  case 'show': if (!target) die('usage: show <file>'); show(resolve(target)); break;
  case 'review': if (!target) die('usage: review <file> --reviewer "<name>"'); setStatus(resolve(target), 'in_review', { reviewer: flag('--reviewer') }); break;
  case 'approve': if (!target) die('usage: approve <file> --reviewer "<name>" [--score N] [--to-community]'); setStatus(resolve(target), 'approved', { reviewer: flag('--reviewer'), score: flag('--score'), note: flag('--note'), toCommunity: has('--to-community') }); break;
  case 'reject': if (!target) die('usage: reject <file> --reviewer "<name>" [--note "..."]'); setStatus(resolve(target), 'rejected', { reviewer: flag('--reviewer'), note: flag('--note') }); break;
  default:
    console.log('review-asset.mjs — Tactile Library Asset QA gate\n');
    console.log('  list   <dir>                                  list assets + QA status');
    console.log('  show   <file>                                 inspect one asset');
    console.log('  review <file> --reviewer "<name>"             draft → in_review');
    console.log('  approve <file> --reviewer "<name>" --score N [--to-community]');
    console.log('  reject <file> --reviewer "<name>" [--note "..."]');
    console.log(`\n  Corpus ships only qa.status=approved AND sharing=community. Min score: ${MIN_SCORE} (--min).`);
    if (cmd) die(`unknown command: ${cmd}`);
}
