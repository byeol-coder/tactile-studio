import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const dir = mkdtempSync(join(tmpdir(), 'tactile-studio-consumer-'));
const packed = execFileSync('npm', ['pack', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8' });
const filename = JSON.parse(packed)[0].filename;
const tarball = new URL(filename, root);
writeFileSync(join(dir, 'package.json'), JSON.stringify({
  type: 'module',
  dependencies: {
    'tactile-studio': tarball.href,
    react: '^18.3.1',
    'react-dom': '^18.3.1',
  },
}));
execFileSync('npm', ['install', '--ignore-scripts'], { cwd: dir, stdio: 'inherit' });
writeFileSync(join(dir, 'smoke.mjs'), [
  "await import('tactile-studio/core');",
  "await import('tactile-studio/codecs');",
  "await import('tactile-studio/device');",
  "await import('tactile-studio/storage');",
  "await import('tactile-studio/react');",
].join('\n'));
execFileSync(process.execPath, ['smoke.mjs'], { cwd: dir, stdio: 'inherit' });
const pkg = JSON.parse(readFileSync(join(dir, 'node_modules/tactile-studio/package.json'), 'utf8'));
if (!pkg.exports || !pkg.files) throw new Error('packed package metadata is incomplete');
rmSync(tarball, { force: true });
console.log('packed-package consumer smoke test passed');
