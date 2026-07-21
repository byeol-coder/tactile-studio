// WCAG 2.1 contrast gate for the Tactile Studio token palette.
// Run: node scripts/check-contrast.mjs   (exit 1 on any failure → CI gate)
//
// Checks the FINAL palette (post token migration). Pairs marked kind:'text'
// need 4.5:1, 'large' (18px+/14px bold+ or UI components) need 3:1.

const hex = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = ([r, g, b]) => {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// ── final palette ──────────────────────────────────────────────────────
const P = {
  primary: '#C43D00',        // brand orange (text/CTA)
  primaryLegacy: '#EC5927',  // decorative/large-graphic only
  accentIcon: '#C43D00',     // icon/label accent — aliased to primary (NOT the reference
                             // token migration's #E04500, which only reaches 4.18:1 on white)
  textPrimary: '#1E1C1A',
  textSecondary: '#6B6862',
  borderDecor: '#EAE1D7',    // decorative only — 1.4.11 exempt
  danger: '#DA120D',
  success: '#0B8800',
  white: '#FFFFFF',
  warm: '#F7F4EF',
};

const checks = [
  // text (4.5:1)
  ['primary text on white', P.primary, P.white, 'text'],
  ['primary text on warm bg', P.primary, P.warm, 'text'],
  ['white label on primary button', P.white, P.primary, 'text'],
  ['secondary text on white', P.textSecondary, P.white, 'text'],
  ['secondary text on warm bg', P.textSecondary, P.warm, 'text'],
  ['body text on white', P.textPrimary, P.white, 'text'],
  ['danger text on white', P.danger, P.white, 'text'],
  ['accent-icon text on white', P.accentIcon, P.white, 'text'],
  // large text / UI components (3:1)
  ['success indicator on white', P.success, P.white, 'large'],
  ['legacy orange as LARGE graphic on white', P.primaryLegacy, P.white, 'large'],
  ['primary as UI boundary on white', P.primary, P.white, 'large'],
];

let fail = 0;
console.log('WCAG 2.1 contrast gate — final palette\n');
for (const [name, fg, bg, kind] of checks) {
  const r = ratio(fg, bg);
  const need = kind === 'text' ? 4.5 : 3.0;
  const ok = r >= need;
  if (!ok) fail++;
  console.log(
    `${ok ? '✅' : '❌'} ${name.padEnd(42)} ${fg} on ${bg}  ${r.toFixed(2)}:1 (need ${need})`
  );
}
console.log(
  `\nnote: --ts-border-decor(${P.borderDecor}) is decorative-only (WCAG 1.4.11 exempt);` +
    ` functional boundaries must use --ts-primary or a ≥3:1 tone (tracked in migration report).`
);
console.log(
  `note: --ts-accent-bg-soft(#FFF1EA) is a background-only tint (chip fills) — no text` +
    ` renders directly in it, so it carries no contrast obligation of its own; whatever` +
    ` foreground sits on top of it must still be checked against #FFF1EA's luminance.`
);
if (fail) {
  console.error(`\n${fail} contrast check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll contrast checks passed.');
