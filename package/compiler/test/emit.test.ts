import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from 'vitest';
import { SscManager } from '~/ssc/manager/ssc.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');

async function runProcess(entryPath: string) {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    const manager = await SscManager.init({ outDir, profile: 'test' });
    const { modules } = await manager.buildManager.compile(entryPath);
    const binPath = await manager.buildManager.emit(modules, { entryPath });
    const { status, stderr } = spawnSync(binPath, { encoding: 'utf8' });

    return { status, stderr };
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
}

async function run(entryPath: string) {
  return (await runProcess(entryPath)).status;
}

async function runSource(source: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    const entryPath = path.join(dir, 'entry.ts');

    await fs.writeFile(entryPath, `declare function exit(code: i32): void;\n${source}`);

    return await runProcess(entryPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
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

test('variable-run.ts', async () => {
  expect(await run(path.join(fixtureDir, 'variable-run.ts'))).toBe(117);
});

test('top-level-variable.ts', async () => {
  expect(await run(path.join(fixtureDir, 'top-level-variable.ts'))).toBe(8);
});

test('top-level-import.ts', async () => {
  expect(await run(path.join(fixtureDir, 'top-level-import.ts'))).toBe(7);
});

test('top-level-rename.ts', async () => {
  expect(await run(path.join(fixtureDir, 'top-level-rename.ts'))).toBe(5);
});

test('tdz-function.ts', async () => {
  expect(await runProcess(path.join(fixtureDir, 'tdz-function.ts'))).toEqual({
    status: 1,
    stderr: "ReferenceError: Cannot access 'value' before initialization\n",
  });
});

test('tdz-after.ts', async () => {
  expect(await run(path.join(fixtureDir, 'tdz-after.ts'))).toBe(7);
});

test('tdz-cycle.ts', async () => {
  expect(await runProcess(path.join(fixtureDir, 'tdz-cycle.ts'))).toEqual({
    status: 1,
    stderr: "ReferenceError: Cannot access 'value' before initialization\n",
  });
});

test('tdz-reference.ts', async () => {
  expect(await run(path.join(fixtureDir, 'tdz-reference.ts'))).toBe(7);
});

test('tdz-extern.ts', async () => {
  expect(await run(path.join(fixtureDir, 'tdz-extern.ts'))).toBe(7);
});

test('arithmetic.ts', async () => {
  expect(await run(path.join(fixtureDir, 'arithmetic.ts'))).toBe(28);
});

test('literal-type.ts', async () => {
  expect(await run(path.join(fixtureDir, 'literal-type.ts'))).toBe(123);
});

test('bitwise.ts', async () => {
  expect(await run(path.join(fixtureDir, 'bitwise.ts'))).toBe(63);
});

test('logical.ts', async () => {
  expect(await run(path.join(fixtureDir, 'logical.ts'))).toBe(255);
});

test('unary.ts', async () => {
  expect(await run(path.join(fixtureDir, 'unary.ts'))).toBe(127);
});

test('update.ts', async () => {
  expect(await run(path.join(fixtureDir, 'update.ts'))).toBe(63);
});

test('loop.ts', async () => {
  expect(await run(path.join(fixtureDir, 'loop.ts'))).toBe(75);
});

test('constructor.ts', async () => {
  expect(await run(path.join(fixtureDir, 'constructor.ts'))).toBe(255);
});

test('comparison.ts', async () => {
  expect(await run(path.join(fixtureDir, 'comparison.ts'))).toBe(119);
});

test.each([
  ['u8 add', 'u8', 'function f(a: u8, b: u8): u8 { return a + b; }\nf(200, 100);'],
  ['i32 add', 'i32', 'function f(a: i32): i32 { return a + 1; }\nf(2147483647);'],
  ['u32 sub', 'u32', 'function f(a: u32): u32 { return a - 1; }\nf(0);'],
  ['u16 mul', 'u16', 'function f(a: u16, b: u16): u16 { return a * b; }\nf(65535, 65535);'],
  ['i64 mul', 'i64', 'function f(a: i64): i64 { return a * 2; }\nf(9223372036854775807);'],
  ['i32 MIN / -1', 'i32', 'function f(a: i32, b: i32): i32 { return a / b; }\nf(-2147483648, -1);'],
  ['unary minus', 'i32', 'function f(a: i32): i32 { return -a; }\nf(-2147483648);'],
  ['compound', 'i8', 'function f(a: i8): i8 { let r: i8 = a; r += 1; return r; }\nf(127);'],
  ['postfix increment', 'u8', 'function f(a: u8): u8 { let r: u8 = a; r++; return r; }\nf(255);'],
  ['prefix increment', 'i8', 'function f(a: i8): i8 { let r: i8 = a; return ++r; }\nf(127);'],
  ['postfix decrement', 'u32', 'function f(a: u32): u32 { let r: u32 = a; return r--; }\nf(0);'],
  [
    'prefix decrement',
    'i64',
    'function f(a: i64): i64 { let r: i64 = a; --r; return r; }\nf(-9223372036854775808);',
  ],
])('%s overflow', async (_, type, source) => {
  expect(await runSource(`${source}\nexit(0);`)).toEqual({
    status: 1,
    stderr: `RangeError: Overflow: ${type}\n`,
  });
});

test.each([
  ['div', 'i32', 'function f(a: i32, b: i32): i32 { return a / b; }\nf(1, 0);'],
  ['rem', 'u8', 'function f(a: u8, b: u8): u8 { return a % b; }\nf(1, 0);'],
])('%s by zero', async (_, type, source) => {
  expect(await runSource(`${source}\nexit(0);`)).toEqual({
    status: 1,
    stderr: `RangeError: Division by zero: ${type}\n`,
  });
});

test.each([
  ['i32 too large', 'i32', 'function f(a: i32, b: i32): i32 { return a << b; }\nf(1, 32);'],
  [
    'i32 negative',
    'i32',
    'function f(a: i32, b: i32): i32 { return a >> b; }\nconst zero: i32 = 0;\nf(1, zero - 1);',
  ],
  ['u8 too large', 'u8', 'function f(a: u8, b: u8): u8 { return a >>> b; }\nf(1, 8);'],
])('shift count %s', async (_, type, source) => {
  expect(await runSource(`${source}\nexit(0);`)).toEqual({
    status: 1,
    stderr: `RangeError: Shift count out of range: ${type}\n`,
  });
});

test.each([
  ['beyond the last code point', '0x110000', 'RangeError: Invalid code point 1114112\n'],
  ['a surrogate', '0xd800', 'RangeError: Invalid code point 55296\n'],
])('char constructor rejects %s', async (_, codePoint, stderr) => {
  const source = `function of(codePoint: u32): char { return char(codePoint); }\nof(${codePoint});`;

  expect(await runSource(`${source}\nexit(0);`)).toEqual({ status: 1, stderr });
});

test.each([
  ['a narrowing', 'function f(v: i64): i32 { return i32(v); }'],
  ['a literal out of range', 'const v: u8 = u8(300);'],
  ['a number to char', 'function f(v: i32): char { return char(v); }'],
])('a constructor rejects %s', async (_, source) => {
  await expect(runSource(source)).rejects.toThrow('typescript errors');
});
