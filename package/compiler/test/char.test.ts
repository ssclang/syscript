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

test('a char literal is its code point', async () => {
  const { status, c } = await run(`
function isA(c: char): boolean {
  return c === 'A';
}
if (isA('A') && !isA('B')) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
  expect(c).toContain("U'\\U00000041'");
});

test('char literals of every width and escape', async () => {
  const { status } = await run(`
function same(a: char, b: char): boolean {
  return a === b;
}
const hangul: char = '한';
const emoji: char = '👍';
if (hangul === '\\uD55C' && same(emoji, '\\u{1F44D}') && same(emoji, '\\uD83D\\uDC4D') && same('\\'', "'")) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('char compares as its code point', async () => {
  const { status } = await run(`
function isUpper(c: char): boolean {
  return 'A' <= c && c <= 'Z';
}
function isA(c: char): boolean {
  return c === 65;
}
if (isUpper('Q') && !isUpper('q') && isA('A')) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('char computes as u32', async () => {
  const { status } = await run(`
function next(c: char): u32 {
  return c + 1;
}
function digit(c: char): u32 {
  return c - 0x30;
}
if (next('A') === 66 && digit('7') === 7) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('char widens to wider numbers', async () => {
  const { status } = await run(`
function widen(c: char): boolean {
  const a: u32 = c;
  const b: u64 = c;
  const d: i64 = c;
  const e: f64 = c;
  return a === 65 && b === 65 && d === 65 && e === 65;
}
if (widen('A')) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('a char literal widens to wider numbers', async () => {
  const { status } = await run(`
function code(v: u32): u32 {
  return v;
}
const a: u32 = 'A';
const b: u64 = 'A';
const d: i64 = '한';
const e: f64 = '👍';
if (a === 65 && b === 65 && d === 54620 && e === 128077 && code('A') === 65) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test('char is a union member', async () => {
  const { status } = await run(`
function codeOr(c: char | undefined, fallback: u32): u32 {
  if (c === undefined) {
    return fallback;
  }
  return c;
}
function kind(c: char | boolean): i32 {
  if (typeof c === 'number') {
    return 1;
  }
  return 2;
}
if (codeOr('A', 0) === 65 && codeOr(undefined, 7) === 7 && kind('A') === 1 && kind(true) === 2) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});
