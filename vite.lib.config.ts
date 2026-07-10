// vite.lib.config.ts
//
// Library-mode build for the distributable package surface: core, codecs,
// device, storage, react — each built as its own ESM entry so a consuming
// host can import only what it needs (e.g. `<pkg>/core` without pulling in
// React at all). This is SEPARATE from vite.config.ts (the development
// shell's dev-server config) and from the vanilla app at the repo root,
// which this build never touches.
//
// React/ReactDOM are external — the host app supplies its own, exactly like
// any peer-dependency-based React component library. Node built-ins used
// only by the Node-native liblouis adapter (codecs/braille/liblouis-node.ts)
// are external too: that module is for Node-side consumers (tooling, SSR
// prep, tests), not for bundling into a browser build.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const NODE_BUILTIN_EXTERNALS = [
  'node:fs', 'node:module', 'node:path', 'node:url', 'node:crypto',
  'fs', 'module', 'path', 'url', 'crypto',
];

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/lib',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    lib: {
      entry: {
        core: resolve(__dirname, 'src/core/index.ts'),
        codecs: resolve(__dirname, 'src/codecs/index.ts'),
        device: resolve(__dirname, 'src/device/index.ts'),
        storage: resolve(__dirname, 'src/storage/index.ts'),
        react: resolve(__dirname, 'src/react/index.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}/index.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', ...NODE_BUILTIN_EXTERNALS],
      output: {
        preserveModules: false,
      },
    },
  },
});
