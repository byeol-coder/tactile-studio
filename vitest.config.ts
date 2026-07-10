import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Regression fixtures are exact-value comparisons; no snapshot auto-update.
    update: false,
  },
});
