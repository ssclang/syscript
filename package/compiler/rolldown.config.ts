import { defineConfig } from 'rolldown';

export default defineConfig([
  {
    input: 'src/main.ts',
    platform: 'node',
    output: {
      codeSplitting: false,
      minify: true,
      sourcemap: true,
      banner: [
        `const _sscTsserverPath='../../../../ssclang/TypeScript/built/local/tsc';`,
        `const _sscPreludeDir='../../../prelude/';`,
      ].join(''),
    },
    external: ['typescript', /^typescript7/],
  },
]);
