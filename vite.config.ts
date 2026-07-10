// vite.config.ts
//
// Vite 5.4 dev server / build for the React development shell ONLY (see
// dev/index.html, dev/main.tsx). Rooted at `dev/` deliberately — the repo
// root's index.html is the CANONICAL vanilla x-dc application (see
// tools/harness.mjs and the Phase 1-4 regression suite) and must never be
// confused with or served by this config. `npm run dev` here only ever
// touches src/react, src/ui, src/core, src/codecs, src/device, src/storage,
// src/app/development-shell — never index.html/support.js/vendor/corpus*.js.
//
// This is NOT a build config for the reusable <TactileStudioEditor> package
// itself (no library-mode entry/externals yet) — it exists to prove the
// React layer actually boots and renders in a real browser via Vite, per
// the target stack's React 18.3.1 + Vite 5.4 requirement. Packaging
// <TactileStudioEditor> for consumption by Tactile World is Phase 6/7 work.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'dev',
  plugins: [react()],
  build: {
    outDir: '../dist/dev-shell',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
