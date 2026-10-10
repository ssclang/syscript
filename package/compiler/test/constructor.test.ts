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

test('a number constructor widens its argument', async () => {
  const { status, c } = await run(`
function widen(v: i32): i64 {
  return i64(v);
}
if (widen(-1) === -1 && u8(255) === 255 && f64(u32(7)) === 7) {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
  expect(c).toContain('ssc__fn__i64(');
});

test('char constructor makes a char from a code point', async () => {
  const { status } = await run(`
function of(codePoint: u32): char {
  return char(codePoint);
}
if (of(65) === 'A' && char(0x1f44d) === '👍' && char('A') === 'A') {
  exit(0);
}
exit(1);
`);

  expect(status).toBe(0);
});

test.each([
  ['beyond the last code point', '0x110000', 'RangeError: Invalid code point 1114112\n'],
  ['a surrogate', '0xd800', 'RangeError: Invalid code point 55296\n'],
])('char constructor rejects %s', async (_, codePoint, message) => {
  const { status, stderr } = await run(`
function of(codePoint: u32): char {
  return char(codePoint);
}
of(${codePoint});
exit(0);
`);

  expect(stderr).toBe(message);
  expect(status).toBe(1);
});

test.each([
  ['a narrowing', 'function f(v: i64): i32 { return i32(v); }'],
  ['a literal out of range', 'const v: u8 = u8(300);'],
  ['a number to char', 'function f(v: i32): char { return char(v); }'],
])('a constructor rejects %s', async (_, source) => {
  await expect(run(source)).rejects.toThrow('typescript errors');
});
