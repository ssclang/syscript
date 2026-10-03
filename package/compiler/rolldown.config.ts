import { defineConfig } from 'rolldown';

export default defineConfig([
  {
    input: 'src/main.ts',
    platform: 'node',
    output: {
      codeSplitting: false,
      minify: true,
      sourcemap: true,
      banner: `const _sscPreludeDir='../src/prelude/';`,
    },
    external: ['typescript', /^typescript7/],
  },
]);
