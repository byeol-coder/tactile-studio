// vite.standalone.config.ts
//
// Vite build for the REAL production standalone entry (standalone/index.html
// + standalone/main.tsx) — as opposed to vite.config.ts, which builds the
// mock-services dev-shell for local component development only (see that
// file's own doc comment). Rooted at `standalone/` deliberately, same
// isolation principle as the dev-shell config: the repo root's index.html
// remains the CANONICAL vanilla x-dc application and must never be confused
// with or served by this config.
//
// publicDir points at the repo's own vendor/tw/ folder specifically (not a
// copy, and NOT the whole vendor/ folder — that also holds liblouis/'s full
// table set and standalone React UMD builds this entry doesn't use yet, so
// pointing at all of vendor/ would ship dead weight). Vite copies a
// publicDir's CONTENTS to the output root, so vendor/tw/dotpad-sdk.js ends up
// at dist/standalone/dotpad-sdk.js (served at /dotpad-sdk.js in dev) — hence
// standalone/index.html references "./dotpad-sdk.js", not
// "./vendor/tw/dotpad-sdk.js" or "./tw/dotpad-sdk.js".

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'standalone',
  publicDir: resolve(__dirname, 'vendor/tw'),
  plugins: [react()],
  build: {
    outDir: '../dist/standalone',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
});
