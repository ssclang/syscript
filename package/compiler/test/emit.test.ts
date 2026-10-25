import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import * as ast from 'typescript7/ast';
import { expect, test } from 'vitest';
import { SscManager } from '~/ssc/manager/ssc.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');

async function spawn(entryPath: string) {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    const manager = await SscManager.init({ outDir, profile: 'test' });
    const { modules } = await manager.buildManager.compile(entryPath);
    const binPath = await manager.buildManager.emit(modules, { entryPath });
    const { status, stdout, stderr } = spawnSync(binPath, { encoding: 'utf8' });

    return { status, stdout, stderr };
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
}

async function runProcess(entryPath: string) {
  const { status, stderr } = await spawn(entryPath);

  return { status, stderr };
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

test('wrap.ts', async () => {
  expect(await run(path.join(fixtureDir, 'wrap.ts'))).toBe(7);
});

test('union-value.ts', async () => {
  expect(await run(path.join(fixtureDir, 'union-value.ts'))).toBe(31);
});

test('union.ts', async () => {
  expect(await run(path.join(fixtureDir, 'union.ts'))).toBe(255);
});

test('string.ts', async () => {
  expect(await run(path.join(fixtureDir, 'string.ts'))).toBe(127);
});

test('equality.ts', async () => {
  expect(await run(path.join(fixtureDir, 'equality.ts'))).toBe(63);
});

test('char.ts', async () => {
  expect(await run(path.join(fixtureDir, 'char.ts'))).toBe(63);
});

test('numeric.ts', async () => {
  expect(await run(path.join(fixtureDir, 'numeric.ts'))).toBe(15);
});

test('top-level-order.ts', async () => {
  expect(await run(path.join(fixtureDir, 'top-level-order.ts'))).toBe(123);
});

test('top-level-export-let.ts', async () => {
  expect(await run(path.join(fixtureDir, 'top-level-export-let.ts'))).toBe(3);
});

test('main.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'main.ts'))).toEqual({
    status: 10,
    stdout: '10\n6765\n1\n0\n5\n11\n25\n',
    stderr: '',
  });
});

test('union-update.ts', async () => {
  expect(await run(path.join(fixtureDir, 'union-update.ts'))).toBe(15);
});

test('output.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'output.ts'))).toEqual({
    status: 0,
    stdout: 'hello, syscript\n한글 👍\n',
    stderr: 'warning\n',
  });
});

test('console.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'console.ts'))).toEqual({
    status: 0,
    stdout: [
      'integer: -42 18446744073709551615',
      '0.30000000000000004 0.1 1e+21 1',
      'NaN Infinity -Infinity 0',
      'true null undefined 👍',
      '7',
      'text',
      'undefined',
      'n=-42, f=0.1, ok=true, c=👍',
      '',
      '',
    ].join('\n'),
    stderr: 'error 1\n',
  });
});

test('as-const.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'as-const.ts'))).toEqual({
    status: 0,
    stdout: '5 0.5 ab A\n',
    stderr: '',
  });
});

test('as.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'as.ts'))).toEqual({
    status: 0,
    stdout: '7 a undefined b true\n3 4 5\n',
    stderr: '',
  });
});

test.each([
  [
    'a string as i32',
    'i32',
    'string',
    "function f(v: i32 | string): i32 { return v as i32; }\nf('x');",
  ],
  [
    'an i32 as string',
    'string',
    'i32',
    'function f(v: i32 | string): string { return v as string; }\nf(1);',
  ],
  [
    'an i32 as a smaller union',
    'string | undefined',
    'i32',
    'function f(v: i32 | string | undefined): string | undefined { return v as string | undefined; }\nf(1);',
  ],
  [
    'an f64 literal storage as i32',
    'i32',
    'i64',
    'function f(v: i32 | f64 | string): i32 { return v as i32; }\nf(1);',
  ],
])('as rejects %s', async (_, target, actual, source) => {
  expect(await runSource(`${source}\nexit(0);`)).toEqual({
    status: 1,
    stderr: `TypeError: Type '${actual}' is not assignable to type '${target}'\n`,
  });
});

test.each([
  [
    'a number to another number type',
    'export function f(x: i32): u8 {\n  return x as u8;\n}\n',
    "'as' can not convert 'i32' to 'u8'",
  ],
  [
    'a string to unknown',
    "const s: string = 'a';\nexport const x: string = s as unknown as string;\n",
    "'as' can not convert 'string' to 'unknown'",
  ],
  [
    'an out of range literal',
    'export const x: u8 = 300 as u8;\n',
    "'300' can not be converted to u8",
  ],
])('as with %s', async (_, source, message) => {
  await expect(runSource(source)).rejects.toThrow(message);
});

test('array.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'array.ts'))).toEqual({
    status: 0,
    stdout: [
      "[ 1, 2, 3 ] [ 'a', 'b' ] [] [ 1, 'x' ] [ [ 1, 2 ], [ 3 ] ]",
      '3 1 3 undefined',
      '[ 1, 20, 3 ]',
      '5 [ 1, 20, 3, 4, 5 ]',
      '5 4 undefined',
      '5',
      'b 1,20,3,4,6 w=a,b',
      '34',
      '',
    ].join('\n'),
    stderr: '',
  });
});

test('array write at the length', async () => {
  const source = 'const a: i32[] = [1];\na[1] = 2;\nexit(0);';

  expect(await runSource(source)).toEqual({
    status: 1,
    stderr: 'RangeError: Index 1 is out of bounds for length 1\n',
  });
});

test.each([
  ['a fractional literal', 'a[1.5]'],
  ['a negative literal', 'a[-1]'],
  ['an i32 variable', 'a[signed]'],
  ['an f64 variable', 'a[float]'],
])('array index with %s', async (_, access) => {
  const source = `const a: i32[] = [1];\nconst signed: i32 = 0;\nconst float: f64 = 0;\nconst x = ${access};`;

  await expect(runSource(source)).rejects.toThrow('typescript errors');
});

test('object.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'object.ts'))).toEqual({
    status: 0,
    stdout: 'numbers\nempty\ntext\nblank\ntrue false true true true\n',
    stderr: '',
  });
});

test('conditional.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'conditional.ts'))).toEqual({
    status: 0,
    stdout: '1 2 3 none\n5 0 6 none default x\nyes 2\n',
    stderr: '',
  });
});

test('order.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'order.ts'))).toEqual({
    status: 0,
    stdout: [
      'call abc',
      'nested call bacdef',
      'add ab',
      'arithmetic abcde',
      'bitwise abcd',
      'shift abc',
      'float abc',
      'compare ab',
      'equality ab',
      'concat abc',
      'template abc',
      '1 2 3',
      'console.log abc',
      'array literal abc',
      'push ab',
      'element assignment ab',
      'element access a',
      'compound assignment 2',
      'compound assignment b',
      'read before call 120',
      'read before call b',
      '',
    ].join('\n'),
    stderr: '',
  });
});

test('closure.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'closure.ts'))).toEqual({
    status: 0,
    stdout: '1 2 1 3\n15 42 0\n7\n10 6 210\nfunction true false\n',
    stderr: '',
  });
});

test('array-callback.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'array-callback.ts'))).toEqual({
    status: 0,
    stdout: [
      '0:1 1:2 2:3 3:4 ',
      '[ 10, 20, 30, 40 ] [ 1, 2, 3 ]',
      "[ 2, 4 ] [ 'bb', 'ccc' ]",
      '110 >abbccc',
      '3 undefined bb',
      'true false',
      'true false',
      '2 -1 2',
      '',
    ].join('\n'),
    stderr: '',
  });
});

test('template.ts', async () => {
  expect(await spawn(path.join(fixtureDir, 'template.ts'))).toEqual({
    status: 0,
    stdout: [
      'plain',
      'hello, syscript!',
      '3 items',
      'ratio=0.5, ok=true, value=undefined',
      '👍👍',
      'sum=4, nested=[syscript]',
      '한글 syscript ${escaped} `tick`',
      'line1',
      'line2',
      '',
    ].join('\n'),
    stderr: '',
  });
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
  ['compound div', 'i32', 'function f(a: i32): i32 { let x: i32 = 1; x /= a; return x; }\nf(0);'],
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

const cppKeywords = [
  'alignas',
  'alignof',
  'and',
  'and_eq',
  'asm',
  'auto',
  'bitand',
  'bitor',
  'bool',
  'char8_t',
  'char16_t',
  'char32_t',
  'compl',
  'concept',
  'consteval',
  'constexpr',
  'constinit',
  'const_cast',
  'co_await',
  'co_return',
  'co_yield',
  'decltype',
  'double',
  'dynamic_cast',
  'explicit',
  'extern',
  'float',
  'friend',
  'goto',
  'inline',
  'int',
  'long',
  'mutable',
  'namespace',
  'noexcept',
  'not',
  'not_eq',
  'nullptr',
  'operator',
  'or',
  'or_eq',
  'register',
  'reinterpret_cast',
  'requires',
  'restrict',
  'short',
  'signed',
  'sizeof',
  'static_assert',
  'static_cast',
  'struct',
  'template',
  'thread_local',
  'typedef',
  'typeid',
  'typename',
  'union',
  'unsigned',
  'using',
  'virtual',
  'volatile',
  'wchar_t',
  'xor',
  'xor_eq',
  'main',
  'module',
  'import',
  'export',
  'std',
  'ssc',
  'ts',
  'NULL',
  'errno',
  'stdin',
  'stdout',
  'stderr',
  'assert',
  'offsetof',
  'malloc',
  'free',
];

/** TS가 식별자로 받지 않는 예약어. 모듈은 strict 모드라 `static`, `let` 같은 미래 예약어도 포함한다. */
function isTsReservedWord(word: string) {
  const kind = ast.stringToToken(word);

  return (
    kind !== undefined
    && kind >= ast.SyntaxKind.FirstReservedWord
    && kind <= ast.SyntaxKind.LastFutureReservedWord
  );
}

test('C and C++ keywords can be names', async () => {
  const names = cppKeywords.filter((k) => !isTsReservedWord(k));
  const functions = names.map(
    (name) =>
      `function ${name}(${name}: i32): i32 {\n  const value: i32 = ${name};\n  return value;\n}`,
  );
  const calls = names.map((name) => `  total = total + ${name}(1);`);
  const source = [
    ...functions,
    `function run(): i32 {\n  let total: i32 = 0;\n${calls.join('\n')}\n  return total;\n}`,
    'exit(run());',
  ].join('\n\n');

  expect(names).toContain('int');
  expect(await runSource(source)).toEqual({ status: names.length, stderr: '' });
});
