import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';
import { Env } from '~/util/env.js';

export default defineConfig([
  {
    plugins: [dts({ sourcemap: Env.isDev() })],
    input: 'src/type.ts',
    platform: 'node',
    output: { codeSplitting: false },
  },
  {
    plugins: [dts({ sourcemap: Env.isDev() })],
    input: { util: 'src/util/index.ts' },
    platform: 'node',
    output: { codeSplitting: false },
  },
  {
    plugins: [dts({ sourcemap: Env.isDev() })],
    input: 'src/zod.ts',
    platform: 'node',
    output: { codeSplitting: false },
    external: ['zod'],
  },
]);
