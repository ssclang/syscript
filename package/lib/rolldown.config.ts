import { defineConfig } from 'rolldown';

export default defineConfig([
  {
    input: 'src/main.ts',
    platform: 'node',
    output: {
      entryFileNames: 'main.js',
      // preserveModules: true,
      minify: true,
      sourcemap: true,
      // banner: `const __dirname=import.meta.dirname;`,
      // banner: `const __dirname=import.meta.dirname;const __filename=import.meta.filename;`,
      codeSplitting: false,
    },
    external: ['typescript', /^typescript7/],
  },
  {
    input: 'src/plugin/index.ts',
    platform: 'node',
    output: {
      dir: 'src/plugin',
      entryFileNames: 'index.cjs',
      format: 'cjs',
      exports: 'default',
      codeSplitting: false,
    },
    external: ['typescript'],
  },
]);
