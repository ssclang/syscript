import { defineConfig } from 'rolldown';

// function emitPrelude(): Plugin {
//   const preludePath = 'src/prelude/prelude.d.ts';
//   return {
//     name: 'emit-prelude',
//     buildStart() {
//       return;
//       this.emitFile({
//         type: 'asset',
//         fileName: 'prelude/prelude.d.ts',
//         originalFileName: path.resolve(preludePath),
//         source: fs.readFileSync(preludePath, 'utf8'),
//       });
//     },
//   };
// }

export default defineConfig([
  {
    input: 'src/main.ts',
    platform: 'node',
    // plugins: [emitPrelude()],
    output: {
      entryFileNames: 'main.js',
      // preserveModules: true,
      minify: true,
      sourcemap: true,
      banner: `const _sscPreludeDir='../src/prelude/';`,
      // banner: `const __dirname=import.meta.dirname;`,
      // banner: `const __dirname=import.meta.dirname;const __filename=import.meta.filename;`,
      codeSplitting: false,
    },
    external: ['typescript', /^typescript7/],
  },
]);
