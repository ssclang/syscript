import { spawnSync } from 'child_process';
import path from 'path';
import { expect, test } from 'vitest';
import { SscManager } from '~/ssc/manager/ssc.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');
const outDir = path.join(import.meta.dirname, '.ssc');

const manager = await SscManager.init({ outDir, profile: 'test/run' });

async function run(entryPath: string) {
  const { modules } = await manager.buildManager.compile(entryPath);
  const binPath = await manager.buildManager.emit(modules, { entryPath });

  return spawnSync(binPath, { encoding: 'utf8' }).status;
}

test('main.ts', async () => {
  expect(await run(path.join(fixtureDir, 'main.ts'))).toBe(10);
});
