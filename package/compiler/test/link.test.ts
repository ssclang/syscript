import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from 'vitest';
import { SscManager } from '~/ssc/manager/ssc.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');

/** 파일들을 임시 디렉터리에 쓰고 `entry.ts`를 빌드해 실행한다. 준비 단계에 디렉터리를 넘긴다. */
async function run(files: Record<string, string>, prepare?: (dir: string) => void) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    await fs.copyFile(path.join(fixtureDir, 'libc.d.ts'), path.join(dir, 'libc.d.ts'));

    for (const [name, source] of Object.entries(files)) {
      await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true });
      await fs.writeFile(path.join(dir, name), source);
    }

    prepare?.(dir);

    const entryPath = path.join(dir, 'entry.ts');
    const manager = await SscManager.init({ outDir: path.join(dir, '.ssc'), profile: 'test' });
    const { modules } = await manager.buildManager.compile(entryPath);
    const binPath = await manager.buildManager.emit(modules, { entryPath });

    return spawnSync(binPath, { encoding: 'utf8' }).status;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('C 소스는 따로 컴파일해 링크한다', async () => {
  const status = await run({
    'add.h': 'int add(int a, int b);\n',
    'add.c': 'int add(int a, int b) { return a + b; }\n',
    'add.d.ts': `
// ssc:include:add.h
// ssc:link:add.c

export declare function add(a: i32, b: i32): i32;
`,
    'entry.ts': `
import { exit } from './libc.js';
import { add } from './add.js';

exit(add(2, 3));
`,
  });

  expect(status).toBe(5);
});

test('다른 디렉터리의 같은 이름 소스는 서로 덮어쓰지 않는다', async () => {
  const status = await run({
    'a/util.h': 'int a_value(void);\n',
    'a/util.c': 'int a_value(void) { return 10; }\n',
    'a/util.d.ts': `
// ssc:include:util.h
// ssc:link:util.c

export declare function a_value(): i32;
`,
    'b/util.h': 'int b_value(void);\n',
    'b/util.c': 'int b_value(void) { return 20; }\n',
    'b/util.d.ts': `
// ssc:include:util.h
// ssc:link:util.c

export declare function b_value(): i32;
`,
    'entry.ts': `
import { exit } from './libc.js';
import { a_value } from './a/util.js';
import { b_value } from './b/util.js';

exit(a_value() + b_value());
`,
  });

  expect(status).toBe(30);
});

test('C 소스가 아닌 경로는 링크 명령에 그대로 넘긴다', async () => {
  const status = await run(
    {
      'prebuilt.h': 'int prebuilt(void);\n',
      'prebuilt.d.ts': `
// ssc:include:prebuilt.h
// ssc:link:prebuilt.o

export declare function prebuilt(): i32;
`,
      'entry.ts': `
import { exit } from './libc.js';
import { prebuilt } from './prebuilt.js';

exit(prebuilt());
`,
    },
    (dir) => {
      const source = path.join(dir, 'prebuilt.c');
      spawnSync('sh', ['-c', `printf 'int prebuilt(void) { return 42; }\\n' > ${source}`]);
      const { status } = spawnSync('clang', ['-c', source, '-o', path.join(dir, 'prebuilt.o')]);
      expect(status).toBe(0);
    },
  );

  expect(status).toBe(42);
});

test('꺾쇠는 시스템 라이브러리를 -l로 링크한다', async () => {
  const status = await run({
    'libm.d.ts': `
// ssc:include:<math.h>
// ssc:link:<m>

export declare function hypot(x: f64, y: f64): f64;
`,
    'entry.ts': `
import { exit } from './libc.js';
import { hypot } from './libm.js';

function value(): f64 {
  return hypot(3, 4);
}

exit(value());
`,
  });

  expect(status).toBe(5);
});
