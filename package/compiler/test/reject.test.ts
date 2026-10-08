import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from 'vitest';
import { SscManager } from '~/ssc/manager/ssc.js';

/** 지원하지 않는 문법이 C로 내려가기 전에 막히는지 본다. 다른 파일도 함께 쓸 수 있다. */
async function compile(source: string, files: Record<string, string> = {}) {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    const entryPath = path.join(outDir, 'reject.ts');

    await fs.writeFile(entryPath, source);

    for (const [name, content] of Object.entries(files)) {
      await fs.writeFile(path.join(outDir, name), content);
    }

    const manager = await SscManager.init({ outDir: path.join(outDir, '.ssc'), profile: 'test' });

    return await manager.buildManager.compile(entryPath);
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
}

test('var', async () => {
  const source = `
export function f(): i32 {
  var x: i32 = 1;
  return x;
}
`;

  await expect(compile(source)).rejects.toThrow("'var' is not allowed, use 'const' or 'let'");
});

test('.d.ts에 선언한 ssc__ 함수', async () => {
  const source = `
import { ssc__fn__truthy_f64 } from './evil.js';

export function f(a: f64): boolean {
  return ssc__fn__truthy_f64(a);
}
`;
  const files = {
    'evil.d.ts': `
// ssc:include:<stdio.h>

export declare function ssc__fn__truthy_f64(x: f64): boolean;
`,
  };

  await expect(compile(source, files)).rejects.toThrow("'ssc__fn__truthy_f64' is reserved");
});

test('prelude 타입과 이름만 같은 타입', async () => {
  const source = `
import { i8 } from './shadow.js';

export function f(a: i8): i8 {
  return a;
}
`;
  const files = { 'shadow.d.ts': 'export declare type i8 = number & {};\n' };

  await expect(compile(source, files)).rejects.toThrow("'i8' is not the prelude type");
});

test('moduleDetection이 force가 아닌 tsconfig', async () => {
  const preludePath = path.join(import.meta.dirname, '../../../prelude/prelude.d.ts');
  const tsconfig = (options: object) =>
    JSON.stringify({ compilerOptions: { types: [preludePath], ...options } });
  const source = 'export const a: i32 = 1;\n';

  await expect(
    compile(source, { 'tsconfig.json': tsconfig({ moduleDetection: 'auto' }) }),
  ).rejects.toThrow(`'moduleDetection' must be "force"`);
  await expect(compile(source, { 'tsconfig.json': tsconfig({}) })).rejects.toThrow(
    `'moduleDetection' must be "force"`,
  );
  await expect(
    compile(source, { 'tsconfig.json': tsconfig({ moduleDetection: 'force' }) }),
  ).resolves.toBeDefined();
});

test('유니온의 참거짓 판정', async () => {
  const source = `
export function f(x: i32 | undefined): i32 {
  if (x) {
    return 1;
  }
  return 0;
}
`;

  await expect(compile(source)).rejects.toThrow('not implemented truthiness of union');
});

test('유니온 변수의 증감', async () => {
  const source = `
export function f(): i32 {
  let x: i32 | undefined = 1;
  if (x !== undefined) {
    x++;
    return x;
  }
  return 0;
}
`;

  await expect(compile(source)).rejects.toThrow('is not implemented');
});

test('멤버 표현이 다른 유니온으로 옮기기', async () => {
  const source = `
export function f(x: u8 | undefined): i32 | undefined {
  return x;
}
`;

  await expect(compile(source)).rejects.toThrow('not implemented union conversion');
});
