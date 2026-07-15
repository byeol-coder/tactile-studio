import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'jsdom',
    // Regression fixtures are exact-value comparisons; no snapshot auto-update.
    update: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/app/**', 'src/**/*.d.ts'],
      thresholds: {
        lines: 65,
        functions: 65,
        statements: 65,
        branches: 55,
      },
    },
  },
});
