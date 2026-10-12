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

    await fs.writeFile(entryPath, `import { exit } from './libc.js';\n${source}`);

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

test('length is the byte length', async () => {
  const { status } = await run(`
function length(s: string): u64 {
  return s.length;
}
if (length('hello') === 5 && length('한글') === 6 && length('👍') === 4 && length('') === 0) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('length of a string variable', async () => {
  const { status } = await run(`
const s: string = 'abc';
const n: u64 = s.length;
if (n === 3) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('equality compares every byte', async () => {
  const { status } = await run(`
function equals(a: string, b: string): boolean {
  return a === b;
}
function differs(a: string, b: string): boolean {
  return a !== b;
}
if (
  equals('abc', 'abc')
  && equals('', '')
  && !equals('abc', 'abd')
  && !equals('ab', 'abc')
  && !equals('a\\0b', 'a\\0c')
  && differs('한', '글')
  && !differs('👍', '👍')
) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('ordering compares bytes', async () => {
  const { status } = await run(`
function less(a: string, b: string): boolean {
  return a < b;
}
function lessOrEqual(a: string, b: string): boolean {
  return a <= b;
}
function greater(a: string, b: string): boolean {
  return a > b;
}
function greaterOrEqual(a: string, b: string): boolean {
  return a >= b;
}
if (
  less('a', 'b')
  && less('ab', 'abc')
  && less('', 'a')
  && less('B', 'a')
  && !less('a', 'a')
  && lessOrEqual('a', 'a')
  && greater('한', 'z')
  && greaterOrEqual('b', 'a')
  && !greaterOrEqual('a', 'b')
) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

/* JS는 UTF-16 코드 유닛 순서라 '￿' < '😀'가 false다. 바이트 순서는 코드 포인트 순서다. */
test('ordering follows code points, not UTF-16 code units', async () => {
  const { status } = await run(`
function less(a: string, b: string): boolean {
  return a < b;
}
if (less('\\uFFFF', '😀')) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('string is a union member', async () => {
  const { status } = await run(`
function orEmpty(s: string | undefined): string {
  if (s === undefined) {
    return '';
  }
  return s;
}
function kind(v: string | i32): i32 {
  if (typeof v === 'string' && v.length === 2) {
    return 1;
  }
  return 2;
}
if (orEmpty('hi') === 'hi' && orEmpty(undefined) === '' && kind('ab') === 1 && kind(7) === 2) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});
