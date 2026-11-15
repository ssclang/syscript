import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from 'vitest';
import { compile } from '~/compile.js';

async function runSource(source: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'poc-'));

  try {
    const entryPath = path.join(dir, 'main.ss');

    await fs.writeFile(entryPath, source);

    const binPath = await compile(entryPath, { outDir: path.join(dir, 'out'), type: 'bin' });
    const { status, stdout, stderr } = spawnSync(binPath, { encoding: 'utf8' });

    return { status, stdout, stderr };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('val i64', async () => {
  const source = ['val a = 7', 'std.out(a)'].join('\n');

  expect(await runSource(source)).toEqual({ status: 0, stdout: '7\n', stderr: '' });
});

test('var i64', async () => {
  const source = ['var count = 1', 'count = count + 2', 'std.out(count * 3)'].join('\n');

  expect(await runSource(source)).toEqual({ status: 0, stdout: '9\n', stderr: '' });
});
