import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import * as ast from 'typescript7/unstable/ast';
import { expect, test } from 'vitest';
import { cKeywords } from '~/c/c.js';
import { SscManager } from '~/ssc/manager/ssc.js';

const fixtureDir = path.join(import.meta.dirname, 'fixture');

/** TS가 식별자로 받지 않는 예약어. 모듈은 strict 모드라 `static`, `let` 같은 미래 예약어도 포함한다. */
function isTsReservedWord(word: string) {
  const kind = ast.stringToToken(word);

  return (
    kind !== undefined
    && kind >= ast.SyntaxKind.FirstReservedWord
    && kind <= ast.SyntaxKind.LastFutureReservedWord
  );
}

const names = cKeywords.filter((k) => !isTsReservedWord(k));

/** C 키워드와 매크로를 함수, 매개변수, 지역 변수 이름으로 쓴다. 호출마다 1을 더해 개수를 종료 코드로 돌려준다. */
function renderSource() {
  const functions = names.map((name) =>
    `
function ${name}(${name}: i32): i32 {
  const value: i32 = ${name};
  return value;
}
`.trim(),
  );
  const calls = names.map((name) => `  total = total + ${name}(1);`);

  return `
import { exit } from './libc.js';

${functions.join('\n\n')}

function run(): i32 {
  let total: i32 = 0;
${calls.join('\n')}
  return total;
}

exit(run());
`.trimStart();
}

test('C 키워드를 이름으로 써도 빌드된다', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    const entryPath = path.join(outDir, 'keyword.ts');

    await fs.writeFile(entryPath, renderSource());
    await fs.copyFile(path.join(fixtureDir, 'libc.d.ts'), path.join(outDir, 'libc.d.ts'));

    const manager = await SscManager.init({ outDir: path.join(outDir, '.ssc'), profile: 'test' });
    const { modules } = await manager.buildManager.compile(entryPath);
    const binPath = await manager.buildManager.emit(modules, { entryPath });

    expect(names).toContain('int');
    expect(spawnSync(binPath, { encoding: 'utf8' }).status).toBe(names.length);
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
});
