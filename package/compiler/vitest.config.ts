import { defineConfig } from 'vitest/config';

// https://vitest.dev/config
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globalSetup: 'test/setup.ts',
    coverage: {
      include: ['src/**/*.ts'],
    },
  },
});
