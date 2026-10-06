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

test('literals without a context are f64', async () => {
  const { status } = await run(`
const half = 1 / 2;
if (half === 0.5) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('mixed sign comparison compares in the common type', async () => {
  const { status } = await run(`
function less(a: i32, b: u32): boolean {
  return a < b;
}
if (less(-1, 1)) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('mixed sign arithmetic computes in the common type', async () => {
  const { status } = await run(`
function add(a: i32, b: u32): i64 {
  return a + b;
}
if (add(-1, 1) === 0) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('a literal beyond the operand range widens the common type', async () => {
  const { status, c } = await run(`
function add(a: u8): u16 {
  return a + 300;
}
if (add(255) === 555) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
  expect(c).toContain('(ssc__type__u16)');
});

test('literals follow the C type of their place', async () => {
  const { c } = await run(`
const big = 1e20;
const small: f32 = 0.1;
const overflow = 1e1000;
const underflow = 1e-1000;
const overflow32: f32 = 1e39;
const exponent: i32 = 1e3;
const negative: f32 = -1.5;
exit(0);
`);

  expect(c).toContain('= 100000000000000000000.0;');
  expect(c).toContain('= 0.1f;');
  expect(c).toContain('= __builtin_inf();');
  expect(c).toContain('= 0.0;');
  expect(c).toContain('= __builtin_inff();');
  expect(c).toContain('= (ssc__type__i32)1000uwb;');
  expect(c).toContain('= (-1.5f);');
});

test('a literal the f64 reads as an integer goes into an integer type', async () => {
  const { status, c } = await run('const r: i32 = 1e-1000;\nexit(r);');

  expect(status).toBe(0);
  expect(c).toContain('= (ssc__type__i32)0uwb;');
});

describe('integer arithmetic stops on a result out of its type', () => {
  test.each([
    ['u8 add', 'u8', 'function f(a: u8, b: u8): u8 { return a + b; }\nf(200, 100);'],
    ['i32 add', 'i32', 'function f(a: i32): i32 { return a + 1; }\nf(2147483647);'],
    ['u32 sub', 'u32', 'function f(a: u32): u32 { return a - 1; }\nf(0);'],
    ['u16 mul', 'u16', 'function f(a: u16, b: u16): u16 { return a * b; }\nf(65535, 65535);'],
    ['i64 mul', 'i64', 'function f(a: i64): i64 { return a * 2; }\nf(9223372036854775807);'],
    [
      'i32 MIN / -1',
      'i32',
      'function f(a: i32, b: i32): i32 { return a / b; }\nf(-2147483648, -1);',
    ],
    ['compound', 'i8', 'function f(a: i8): i8 { let r: i8 = a; r += 1; return r; }\nf(127);'],
    ['unary minus', 'i32', 'function f(a: i32): i32 { return -a; }\nf(-2147483648);'],
    ['postfix increment', 'u8', 'function f(a: u8): u8 { let r: u8 = a; r++; return r; }\nf(255);'],
    ['prefix increment', 'i8', 'function f(a: i8): i8 { let r: i8 = a; return ++r; }\nf(127);'],
    ['postfix decrement', 'u32', 'function f(a: u32): u32 { let r: u32 = a; return r--; }\nf(0);'],
    [
      'prefix decrement',
      'i64',
      'function f(a: i64): i64 { let r: i64 = a; --r; return r; }\nf(-9223372036854775808);',
    ],
  ])('%s', async (_, type, source) => {
    const { status, stderr } = await run(`${source}\nexit(0);`);

    expect(stderr).toBe(`RangeError: Overflow: ${type}\n`);
    expect(status).toBe(1);
  });

  test.each([
    ['div', 'i32', 'function f(a: i32, b: i32): i32 { return a / b; }\nf(1, 0);'],
    ['rem', 'u8', 'function f(a: u8, b: u8): u8 { return a % b; }\nf(1, 0);'],
  ])('%s by zero', async (_, type, source) => {
    const { status, stderr } = await run(`${source}\nexit(0);`);

    expect(stderr).toBe(`RangeError: Division by zero: ${type}\n`);
    expect(status).toBe(1);
  });

  test('wrap functions wrap instead', async () => {
    const { status, c } = await run(`
function u8s(a: u8): boolean {
  if (addWrap(a, 100) === 44 && subWrap(a, 201) === 255 && mulWrap(a, 2) === 144) {
    return true;
  }
  return false;
}
function i32s(a: i32): boolean {
  if (addWrap(a, 1) === -2147483648 && mulWrap(a, 2) === -2) {
    return true;
  }
  return false;
}
function u16s(a: u16): boolean {
  return mulWrap(a, a) === 1;
}
if (u8s(200) && i32s(2147483647) && u16s(65535)) {
  exit(0);
}
exit(1);
`);

    expect(status).toBe(0);
    expect(c).toContain('ssc__fn__add_wrap_u8(');
  });

  test('unary operators compute without promotion', async () => {
    const { status } = await run(`
function negate(a: u8): i16 {
  return -a;
}
function invert(a: u8): boolean {
  if (~a === 15) {
    return true;
  }
  return false;
}
function steps(): boolean {
  let x: i32 = 5;
  const a = x++;
  const b = ++x;
  const c = x--;
  const d = --x;
  if (a === 5 && b === 7 && c === 7 && d === 5 && x === 5) {
    return true;
  }
  return false;
}
if (negate(200) === -200 && invert(240) && steps()) {
  exit(0);
}
exit(1);
`);

    expect(status).toBe(0);
  });

  test('bitwise operators compute without promotion', async () => {
    const { status, c } = await run(`
function u8s(a: u8, b: u8): boolean {
  if ((a & b) === 48 && (a | b) === 252 && (a ^ b) === 204) {
    return true;
  }
  return false;
}
function i8s(a: i8, b: i8): boolean {
  if ((a & b) === 4 && (a | b) === -3 && (a ^ b) === -7) {
    return true;
  }
  return false;
}
if (u8s(240, 60) && i8s(-4, 5)) {
  exit(0);
}
exit(1);
`);

    expect(status).toBe(0);
    expect(c).toContain('ssc__fn__bitwise_and_u8(');
  });

  test('compound assignments', async () => {
    const { status } = await run(`
function f(): boolean {
  let x: i32 = 100;
  x /= 3;
  x %= 7;
  let y: u8 = 240;
  y &= 60;
  y |= 3;
  y ^= 1;
  if (x === 5 && y === 50) {
    return true;
  }
  return false;
}
if (f()) {
  exit(0);
}
exit(1);
`);

    expect(status).toBe(0);
  });

  test('compound division by zero', async () => {
    const { status, stderr } = await run(`
function f(a: i32): i32 {
  let x: i32 = 1;
  x /= a;
  return x;
}
f(0);
exit(0);
`);

    expect(stderr).toBe('RangeError: Division by zero: i32\n');
    expect(status).toBe(1);
  });

  test('results in the range', async () => {
    const { status } = await run(`
function u8s(a: u8, b: u8): boolean {
  if (a + b === 255 && a - b === 145 && a * 1 === 200) {
    return true;
  }
  return false;
}
function i32s(a: i32, b: i32): boolean {
  if (a / b === -2 && a % b === -1) {
    return true;
  }
  return false;
}
function min(a: i32, b: i32): i32 {
  return a % b;
}
if (u8s(200, 55) && i32s(-5, 2) && min(-2147483648, -1) === 0) {
  exit(0);
}
exit(1);
`);

    expect(status).toBe(0);
  });
});

test('logical operators on booleans short-circuit as values', async () => {
  const { status } = await run(`
let count: i32 = 0;
function bump(): boolean {
  count++;
  return true;
}
function f(a: boolean, b: boolean): boolean {
  return a && b;
}
const skipped = false && bump();
const taken = true || bump();
const both = f(true, true) || f(false, true);
if (count === 0 && skipped === false && taken && both) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});
