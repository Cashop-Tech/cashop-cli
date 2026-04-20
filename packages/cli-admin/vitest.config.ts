import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
      },
    },
  },
});
