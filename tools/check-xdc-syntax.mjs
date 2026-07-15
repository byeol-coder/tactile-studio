// Extract the single text/x-dc block and syntax-check it (node --check parity).
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extractXdcSource } from './harness.mjs';

const src = extractXdcSource();
writeFileSync('/tmp/xdc-check.js', src);
execFileSync(process.execPath, ['--check', '/tmp/xdc-check.js'], { stdio: 'inherit' });
console.log('x-dc syntax OK (' + src.length + ' chars)');
