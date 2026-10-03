import { defineConfig } from 'vitest/config';

// https://vitest.dev/config
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    coverage: {
      include: ['src/**/*.ts'],
    },
  },
});
