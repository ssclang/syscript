import { assert } from '@syscript/share';
import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

function nodeEnv() {
  const env = process.env['NODE_ENV'];

  if (env === 'development') {
    return 'development';
  }

  if (env === 'production') {
    return 'production';
  }

  throw new Error(env);
}

function isDev() {
  return nodeEnv() === 'development';
}

function isProd() {
  return nodeEnv() === 'production';
}

assert(isDev() !== isProd());

export default defineConfig([
  {
    plugins: [dts({ sourcemap: isDev() })],
    input: 'src/index.ts',
    platform: 'node',
    output: {
      // minify: true,
      // sourcemap: true,
      codeSplitting: false,
    },
    external: ['zod'],
  },
]);
