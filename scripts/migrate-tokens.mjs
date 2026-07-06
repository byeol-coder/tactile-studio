// Phase 0 token migration for index.html — hex → CSS custom properties.
// Run: node scripts/migrate-tokens.mjs          (writes in place + prints report)
//      node scripts/migrate-tokens.mjs --dry    (report only)
//
// Rules:
//  1. Inserts the :root token block right after the app <style> open tag (idempotent).
//  2. Canvas 2D context colors (fillStyle/strokeStyle/shadowColor) CANNOT resolve
//     CSS vars → replaced with LITERAL new values (#C43D00 / rgba(196,61,0,…)).
//  3. <meta name="theme-color"> cannot use vars → literal #C43D00.
//  4. Everything else (template inline styles + JS style objects rendered as DOM
//     inline styles) → var(--ts-*). rgba tints use rgba(var(--ts-primary-rgb),a).
//  5. #9C9994 (2.6–2.8:1, AA fail) is retired: mapped to --ts-text-secondary
//     whose value is #6B6862 (5.5:1). #6B6862 is tokenized to the same var.
//  6. #EAE1D7 → --ts-border-decor (value unchanged; decorative use is 1.4.11
//     exempt). Functional boundaries are listed in the report for a manual pass.

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../index.html', import.meta.url).pathname;
const dry = process.argv.includes('--dry');
let src = readFileSync(FILE, 'utf8');
const before = src;

// Idempotency: strip any existing token block first; the canonical block is
// re-inserted after all replacement steps, so re-runs are exact no-ops.
src = src.replace(/:root\{[^}]*--ts-primary:[^}]*\}\n/, '');

const TOKEN_BLOCK = `:root{
  --ts-primary:#C43D00;            /* brand orange — text/CTA/UI, AA 4.5:1 on white & warm */
  --ts-primary-rgb:196,61,0;       /* tints: rgba(var(--ts-primary-rgb),.08) */
  --ts-primary-decor:#EC5927;      /* LARGE graphics/decor only (3.49:1 — never body text) */
  --ts-text-primary:#1E1C1A;
  --ts-text-secondary:#6B6862;     /* replaces #9C9994 (AA fail) — 5.5:1 */
  --ts-border-decor:#EAE1D7;       /* decorative separators only (1.4.11 exempt) */
  --ts-border-functional:#8C8377;  /* form-field boundaries — 3.4:1+ on white/warm/card */
  --ts-danger:#DA120D;
  --ts-success:#0B8800;
  --ts-bg-warm:#F7F4EF;
}
`;

const count = (s, re) => (s.match(re) || []).length;
const report = [];
const step = (label, re, to) => {
  const n = count(src, re);
  src = src.replace(re, to);
  report.push([label, n]);
};

// ── 2. canvas-context literals FIRST (must stay raw hex/rgba) ──────────
step(
  'canvas ctx #EC5927 → literal #C43D00',
  /((?:fillStyle|strokeStyle|shadowColor)\s*=\s*')#EC5927(')/g,
  '$1#C43D00$2'
);
step(
  'canvas ctx rgba(236,89,39,…) → literal rgba(196,61,0,…)',
  /((?:fillStyle|strokeStyle|shadowColor)\s*=\s*')rgba\(236,\s*89,\s*39,/g,
  '$1rgba(196,61,0,'
);

// ── 3. non-var-capable singletons ──────────────────────────────────────
step(
  'meta theme-color → literal #C43D00',
  /(<meta name="theme-color" content=")#EC5927(")/g,
  '$1#C43D00$2'
);

// ── 4. global tokenization ─────────────────────────────────────────────
step('#EC5927 → var(--ts-primary)', /#EC5927/g, 'var(--ts-primary)');
step(
  'rgba(236,89,39, → rgba(var(--ts-primary-rgb),',
  /rgba\(236,\s*89,\s*39,/g,
  'rgba(var(--ts-primary-rgb),'
);
step('#9C9994 → var(--ts-text-secondary)  [AA fix]', /#9C9994/g, 'var(--ts-text-secondary)');
step('#6B6862 → var(--ts-text-secondary)', /#6B6862/g, 'var(--ts-text-secondary)');
step('#EAE1D7 → var(--ts-border-decor)', /#EAE1D7/g, 'var(--ts-border-decor)');
step('#DA120D → var(--ts-danger)', /#DA120D/g, 'var(--ts-danger)');
step('#0B8800 → var(--ts-success)', /#0B8800/g, 'var(--ts-success)');

// ── 5. token block LAST (values are literals; inserting after replacement
//       steps guarantees the block can never self-replace) ───────────────
src = src.replace(/(<style>\s*\n)/, `$1${TOKEN_BLOCK}`);
report.push(['insert canonical :root token block', 1]);

// ── 6. safety: no var() may have leaked into canvas ctx assignments ────
const leaked = count(src, /(?:fillStyle|strokeStyle|shadowColor)\s*=\s*'[^']*var\(/g);

// ── 6. manual-pass list: functional boundaries still on border-decor ───
const todo = [];
const ALLOW = ['ts-project-name']; // intentional borderless inline-edit (focus-visible covered)
src.split('\n').forEach((line, i) => {
  if (/<(input|select|textarea)\b/.test(line) && line.includes('--ts-border-decor')
      && !ALLOW.some((cls) => line.includes(cls))) {
    todo.push(i + 1);
  }
});

// ── report ─────────────────────────────────────────────────────────────
console.log(`Token migration report — index.html ${dry ? '(DRY RUN)' : ''}\n`);
for (const [label, n] of report) console.log(`  ${String(n).padStart(4)}×  ${label}`);
console.log(`\n  canvas var() leaks: ${leaked} ${leaked ? '❌ ABORT' : '✅'}`);
console.log(
  `  remaining raw #EC5927: ${count(src, /#EC5927/g)} (expected: 1 — --ts-primary-decor literal)`
);
console.log(`  remaining raw #9C9994: ${count(src, /#9C9994/g)} (expected: 1 — token block comment)`);
if (todo.length)
  console.log(
    `\n  MANUAL PASS — functional boundaries on decorative border (lines): ${todo.join(', ')}\n` +
      `  → switch to a ≥3:1 tone or add :focus-visible/aria reliance review.`
  );
if (leaked) process.exit(1);
if (!dry && src !== before) {
  writeFileSync(FILE, src);
  console.log('\nWritten in place. Run scripts/check-contrast.mjs next.');
} else if (dry) {
  console.log('\nDry run — no file written.');
}
