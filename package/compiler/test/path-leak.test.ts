import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from 'vitest';
import { SscManager } from '~/ssc/manager/ssc.js';
import { checkPathLeak } from '~/ssc/path-leak.js';
import { File } from '~/util/file.js';

const leakDefinition = `
// ssc:include:leak.h

export declare function leak(): i32;
`;

const entrySource = `
import { leak } from './leak.js';

leak();
`;

/** `leak.h`를 include하는 프로그램을 빌드하고 검사한다. 검사가 끝나면 디렉터리를 지운다. */
async function checkHeader(header: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-'));

  try {
    const entryPath = path.join(dir, 'entry.ts');
    const binPath = path.join(dir, '.ssc', 'build', 'test', 'entry');

    await fs.writeFile(path.join(dir, 'leak.h'), header);
    await fs.writeFile(path.join(dir, 'leak.d.ts'), leakDefinition);
    await fs.writeFile(entryPath, entrySource);

    const manager = await SscManager.init({ outDir: path.join(dir, '.ssc'), profile: 'test' });
    const { app, modules } = await manager.buildManager.compile(entryPath);

    expect(await manager.buildManager.emit(modules, { entryPath })).toBe(binPath);

    const leaks = await checkPathLeak({
      binPath,
      sourceFiles: app.sourceFiles,
      codeDir: manager.buildManager.codeDir,
      sensitivePaths: [],
      debug: false,
    });

    return { dir, leaks, binExists: await File.exists(binPath) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('헤더의 __FILE__이 남으면 경고하고 바이너리는 남긴다', async () => {
  // include한 헤더의 `__FILE__`은 clang이 헤더의 절대 경로로 펼쳐 바이너리에 넣는다.
  const { dir, leaks, binExists } = await checkHeader(`
#include <stdio.h>

static inline int leak(void) { return puts(__FILE__); }
`);

  // `leak.h`가 있는 디렉터리가 소스 디렉터리 후보로 잡힌다.
  expect(leaks?.filter((l) => l.path === dir).map((l) => l.encoding)).toContain('utf8');
  expect(binExists).toBe(true);
});

test('헤더가 다시 include한 헤더의 경로도 잡는다', async () => {
  // 지시문에는 `leak.h`만 적혀 있다. `nested.h`는 소스, 홈 어느 후보에도 속하지 않는 곳에 있어
  // clang이 남긴 의존성 목록으로만 알 수 있다.
  const nestedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syscript-nested-'));

  try {
    await fs.writeFile(
      path.join(nestedDir, 'nested.h'),
      `
#include <stdio.h>

static inline int nested(void) { return puts(__FILE__); }
`,
    );

    const { leaks } = await checkHeader(`
#include "${path.join(nestedDir, 'nested.h')}"

static inline int leak(void) { return nested(); }
`);

    expect(leaks?.map((l) => l.path)).toContain(nestedDir);
  } finally {
    await fs.rm(nestedDir, { recursive: true, force: true });
  }
});

test('와이드 문자열로 남은 경로도 잡는다', async () => {
  // `u""`와 `L""`를 이어 붙이면 `__FILE__`이 UTF-16, UTF-32 문자열이 된다.
  const { dir, leaks } = await checkHeader(`
#include <stdio.h>
#include <uchar.h>
#include <wchar.h>

static inline int leak(void) {
  const char16_t *volatile utf16 = u"" __FILE__;
  fputws(L"" __FILE__, stdout);
  return utf16 != 0;
}
`);
  const encodings = leaks?.filter((l) => l.path === dir).map((l) => l.encoding);

  expect(encodings).toContain('utf16le');
  expect(encodings).toContain('utf32le');
});
