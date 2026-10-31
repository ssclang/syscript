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
  var x: i32 = i32(1);
  return x;
}
`;

  await expect(compile(source)).rejects.toThrow("'var' is not allowed, use 'const' or 'let'");
});

test('moduleDetection이 force가 아닌 tsconfig', async () => {
  const preludeDtsPath = path.join(import.meta.dirname, '../../../prelude/prelude.d.ts');
  const tsconfig = (options: object) =>
    JSON.stringify({ compilerOptions: { types: [preludeDtsPath], ...options } });
  const source = 'export const a: i32 = i32(1);\n';

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
