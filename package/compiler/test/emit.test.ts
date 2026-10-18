import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from 'vitest';
import { SscManager } from '~/ssc/manager/ssc.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');

async function run(entryPath: string) {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    const manager = await SscManager.init({ outDir, profile: 'test' });
    const { modules } = await manager.buildManager.compile(entryPath);
    const binPath = await manager.buildManager.emit(modules, { entryPath });

    return spawnSync(binPath, { encoding: 'utf8' }).status;
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
}

test('exit-add.ts', async () => {
  expect(await run(path.join(fixtureDir, 'exit-add.ts'))).toBe(7);
});

test('import-function.ts', async () => {
  expect(await run(path.join(fixtureDir, 'import-function.ts'))).toBe(7);
});

test('if-truthy.ts', async () => {
  expect(await run(path.join(fixtureDir, 'if-truthy.ts'))).toBe(7);
});

test('if-union-truthy.ts', async () => {
  expect(await run(path.join(fixtureDir, 'if-union-truthy.ts'))).toBe(10);
});
