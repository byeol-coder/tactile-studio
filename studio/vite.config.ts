import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base is set for GitHub Pages sub-path deploys; adjust when wiring CI.
export default defineConfig({
  plugins: [react()],
  base: './',
});
