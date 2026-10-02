import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from 'vitest';
import { SscManager } from '~/ssc/manager/ssc.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');

/** `entry.ts`를 빌드해 실행한다. 생성된 C도 돌려준다. */
async function run(source: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    await fs.copyFile(path.join(fixtureDir, 'libc.d.ts'), path.join(dir, 'libc.d.ts'));

    const entryPath = path.join(dir, 'entry.ts');

    await fs.writeFile(entryPath, source);

    const manager = await SscManager.init({ outDir: path.join(dir, '.ssc'), profile: 'test' });
    const { modules } = await manager.buildManager.compile(entryPath);
    const binPath = await manager.buildManager.emit(modules, { entryPath });
    const { status } = spawnSync(binPath, { encoding: 'utf8' });
    const c = modules.map((m) => m.output.renderC('<buildDir>')).join('\n');

    return { status, c };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('number는 f64와 같이 NaN을 거짓으로 본다', async () => {
  const { status, c } = await run(`
import { exit } from './libc.js';

function nan(): number {
  const zero: number = 0;
  return zero / zero;
}

if (nan()) {
  exit(1);
}

exit(0);
`);

  expect(status).toBe(0);
  expect(c).toContain('ssc__fn__truthy_f64(');
});
