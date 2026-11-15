import { defineConfig } from 'rolldown';

export default defineConfig([
  {
    input: 'src/main.ts',
    platform: 'node',
    output: {
      codeSplitting: false,
      minify: true,
      sourcemap: true,
    },
  },
]);
