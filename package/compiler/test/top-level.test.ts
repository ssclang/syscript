import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from 'vitest';
import { SscManager } from '~/ssc/manager/ssc.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');

/** 파일들을 임시 디렉터리에 쓰고 `entry.ts`를 빌드해 실행한다. 생성된 C도 돌려준다. */
async function run(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    await fs.copyFile(path.join(fixtureDir, 'libc.d.ts'), path.join(dir, 'libc.d.ts'));

    for (const [name, source] of Object.entries(files)) {
      await fs.writeFile(path.join(dir, name), source);
    }

    const entryPath = path.join(dir, 'entry.ts');
    const manager = await SscManager.init({ outDir: path.join(dir, '.ssc'), profile: 'test' });
    const { modules } = await manager.buildManager.compile(entryPath);
    const binPath = await manager.buildManager.emit(modules, { entryPath });
    const { status, stderr } = spawnSync(binPath, { encoding: 'utf8' });
    const c = modules.map((m) => m.output.renderC('<buildDir>')).join('\n');

    return { status, stderr, c };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('초깃값은 선언이 있던 자리에서 소스 순서대로 평가된다', async () => {
  const { status, c } = await run({
    'entry.ts': `
import { exit } from './libc.js';

let log: i32 = 0;

function push(n: i32): i32 {
  log = log * 10 + n;
  return n;
}

const a: i32 = push(1);
const b: i32 = push(2) + a;
push(3);
exit(log + b * 0);
`,
  });

  expect(status).toBe(123);
  // 선언 전에 접근될 수 없는 변수라 초기화 상태도 검사도 없다.
  expect(c).not.toMatch(/\bssc__module_[0-9a-f]{32}_tag_/);
});

test('export let은 가져온 모듈에서 바뀐 값을 그대로 본다', async () => {
  const { status } = await run({
    'counter.ts': `
export let count: i32 = 0;

export function inc(): void {
  count = count + 1;
}
`,
    'entry.ts': `
import { exit } from './libc.js';
import { count, inc } from './counter.js';

inc();
inc();
inc();
exit(count);
`,
  });

  expect(status).toBe(3);
});

test('함수를 거쳐 선언 전에 접근하면 ReferenceError로 끝난다', async () => {
  const { status, stderr, c } = await run({
    'entry.ts': `
import { exit } from './libc.js';

function read(): i32 {
  return value;
}

exit(read());

const value: i32 = 7;
`,
  });

  expect(status).toBe(1);
  expect(stderr).toBe("ReferenceError: Cannot access 'value' before initialization\n");
  expect(c).toMatch(/\bssc__module_[0-9a-f]{32}_tag_top__value\b/);
});

test('선언 전에 접근될 수 있어도 실제로 선언 뒤에 접근하면 통과한다', async () => {
  const { status } = await run({
    'entry.ts': `
import { exit } from './libc.js';

function read(): i32 {
  return value;
}

const early: boolean = false;

if (early) {
  exit(read());
}

const value: i32 = 7;
exit(read());
`,
  });

  expect(status).toBe(7);
});
