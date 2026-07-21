import { cpSync, mkdirSync, rmSync } from 'node:fs';

const out = new URL('../_site/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const file of ['index.html', 'support.js', 'corpus.js', 'corpus-search.js', 'embed-bridge.js']) {
  cpSync(new URL(`../${file}`, import.meta.url), new URL(file, out));
}
for (const dir of ['assets', 'vendor']) {
  cpSync(new URL(`../${dir}/`, import.meta.url), new URL(`${dir}/`, out), { recursive: true });
}

console.log('prepared minimal GitHub Pages artifact');
