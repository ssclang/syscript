import { Env } from '@syscript/share/util';
import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

export default defineConfig([
  {
    plugins: [dts({ sourcemap: Env.isDev() })],
    input: 'src/index.ts',
    platform: 'node',
    output: { codeSplitting: false },
  },
]);
