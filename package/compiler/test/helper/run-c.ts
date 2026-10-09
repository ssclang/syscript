import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect } from 'vitest';

const preludeDir = path.join(import.meta.dirname, '../../../../prelude');

/** prelude를 직접 쓰는 C 본문을 `main` 안에 넣어 빌드하고 실행한다. */
export async function runC(body: string, prologue = '') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    const source = path.join(dir, 'main.c');
    const binPath = path.join(dir, 'main');

    await fs.writeFile(
      source,
      `#include "prelude.h"\n${prologue}\nint main(void) {\n${body}\n  return 0;\n}\n`,
    );

    const build = spawnSync(
      'clang',
      [
        '-std=gnu23',
        '-O1',
        `-I${preludeDir}`,
        source,
        path.join(preludeDir, 'prelude.c'),
        '-o',
        binPath,
      ],
      { encoding: 'utf8' },
    );

    expect(build.stderr).toBe('');

    return spawnSync(binPath, { encoding: 'utf8' });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
