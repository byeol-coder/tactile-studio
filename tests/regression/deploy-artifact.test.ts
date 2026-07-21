import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Regression guard for a real production bug (2026-07): tools/prepare-pages.mjs
// copies a HARDCODED file list into _site/ for GitHub Pages. When index.html
// gains a new <script src="./x.js"> reference (e.g. embed-bridge.js), it's easy
// to forget to add the file to that list — CI and local tests all read source
// files directly, so nothing catches a script that 404s only in the deployed
// artifact. This test runs the exact same build step deploy.yml runs, then
// parses index.html for local relative <script src> references and asserts
// every one of them actually landed in _site/.
const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');

describe('GitHub Pages deploy artifact (_site) — script completeness', () => {
  it('every relative <script src> in index.html exists in the built _site/', () => {
    // Regenerate _site/ fresh via the real script deploy.yml invokes, so this
    // test can never pass against a stale/hand-edited _site left on disk.
    execFileSync('node', ['tools/prepare-pages.mjs'], { cwd: repoRoot, stdio: 'pipe' });

    const siteIndexPath = resolve(repoRoot, '_site/index.html');
    expect(existsSync(siteIndexPath)).toBe(true);
    const html = readFileSync(siteIndexPath, 'utf8');

    // Only relative, local script tags (skip absolute URLs like CDN scripts,
    // if any are ever added, and skip vendor/* which is copied wholesale as a
    // directory rather than an individual file).
    const srcRe = /<script[^>]+src="\.\/([^"]+)"/g;
    const referenced: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = srcRe.exec(html))) referenced.push(m[1]);

    expect(referenced.length).toBeGreaterThan(0); // sanity: the regex itself still matches something

    const missing = referenced.filter((f) => !existsSync(resolve(repoRoot, '_site', f)));
    expect(missing).toEqual([]);
  });
});
