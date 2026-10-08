import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, test } from 'vitest';
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

test('optional return narrowed by an undefined check', async () => {
  const { status, c } = await run(`
function find(target: i32): i32 | undefined {
  if (target > 10) {
    return undefined;
  }
  return target * 2;
}
function use(target: i32): i32 {
  const found = find(target);
  if (found === undefined) {
    return -1;
  }
  return found + 1;
}
if (use(3) === 7 && use(20) === -1) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
  expect(c).toContain('ssc__fn__union_get_i32(');
});

test('local and global variables hold a union', async () => {
  const { status } = await run(`
let last: i32 | undefined = undefined;
function remember(a: i32): i32 {
  let x: i32 | undefined = undefined;
  if (a > 0) {
    x = a;
    last = a;
  }
  if (x !== undefined) {
    return x;
  }
  return 0;
}
function lastOr(fallback: i32): i32 {
  if (last === undefined) {
    return fallback;
  }
  return last;
}
if (lastOr(9) === 9 && remember(5) === 5 && remember(-1) === 0 && lastOr(9) === 5) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('a value goes into a union member it fits without loss', async () => {
  const { status } = await run(`
function orZero(v: i32 | undefined): i32 {
  if (v === undefined) {
    return 0;
  }
  return v;
}
function small(a: u8): i32 {
  return orZero(a) + orZero(undefined) + orZero(300);
}
if (small(7) === 307) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('a number union converts to the common type', async () => {
  const { status } = await run(`
function next(v: i32 | i64): i64 {
  return v + 1;
}
function both(a: i32, b: i64): i64 {
  return next(a) + next(b);
}
if (both(1, 10) === 13) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('typeof narrows a union of three members', async () => {
  const { status } = await run(`
function score(x: i32 | boolean | undefined): i32 {
  if (x === undefined) {
    return 0;
  }
  if (typeof x === 'boolean') {
    if (x) {
      return 1;
    }
    return 2;
  }
  return x + 10;
}
function widen(v: i32 | undefined): i32 | boolean | undefined {
  return v;
}
if (score(undefined) === 0 && score(true) === 1 && score(false) === 2 && score(5) === 15 && score(widen(7)) === 17 && score(widen(undefined)) === 0) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('null is a member like undefined', async () => {
  const { status } = await run(`
function orNegative(x: i32 | null): i32 {
  if (x === null) {
    return -1;
  }
  return x;
}
function kind(x: i32 | null | undefined): i32 {
  if (x === undefined) {
    return 0;
  }
  if (typeof x === 'object') {
    return 1;
  }
  return 2;
}
if (orNegative(null) === -1 && orNegative(4) === 4 && kind(undefined) === 0 && kind(null) === 1 && kind(7) === 2) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('undefined and null are types of their own', async () => {
  const { status } = await run(`
const nothing = undefined;
function none(): undefined {
  return nothing;
}
function nullCount(x: null): i32 {
  return 1;
}
function wrap(): i32 | undefined {
  const value = none();
  return value;
}
function unwrap(a: i32): i32 {
  let x: i32 | null = null;
  if (a > 0) {
    x = a;
  }
  if (x === null) {
    const y: null = x;
    return nullCount(y);
  }
  return 0;
}
if (wrap() === undefined && nullCount(null) === 1 && unwrap(-1) === 1 && unwrap(1) === 0) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

describe('reading a union as a type it does not hold stops', () => {
  const preludeDir = path.join(import.meta.dirname, '../../../prelude');

  /* TS가 막아 소스로는 만들 수 없어 prelude 함수를 C에서 직접 부른다. */
  async function runC(body: string) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

    try {
      const source = path.join(dir, 'main.c');
      const binPath = path.join(dir, 'main');

      await fs.writeFile(
        source,
        `#include "prelude.h"\nint main(void) {\n${body}\n  return 0;\n}\n`,
      );

      const build = spawnSync(
        'clang',
        [
          '-std=gnu23',
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

  test.each([
    [
      'member',
      'ssc__fn__union_get_i32(ssc__fn__union_from_undefined((ssc__type__undefined){}));',
      "Type 'undefined' is not assignable to type 'i32'",
    ],
    [
      'number',
      'ssc__fn__union_number_to_i64(ssc__fn__union_from_boolean(true));',
      "Type 'boolean' is not assignable to type 'number'",
    ],
    [
      'uninitialized',
      'ssc__type__union value = {0};\n  ssc__fn__union_get_i32(value);',
      "Type '#0' is not assignable to type 'i32'",
    ],
  ])('%s', async (_, body, message) => {
    const { status, stderr } = await runC(body);

    expect(stderr).toBe(`TypeError: ${message}\n`);
    expect(status).toBe(1);
  });
});
