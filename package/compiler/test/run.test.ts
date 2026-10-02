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

test('main.ts', async () => {
  expect(await run(path.join(fixtureDir, 'main.ts'))).toBe(10);
});
