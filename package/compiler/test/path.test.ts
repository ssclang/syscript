import fs from 'fs/promises';
import os from 'os';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { AbsolutePath, Path } from '~/util/path.js';

/** 루트만 `/`로 끝날 수 있다. 그 밖의 경로는 끝에 `/`가 없어야 같은 경로가 같은 문자열이 된다. */
function expectNoTrailingSlash(path: string) {
  expect(path === '/' || !path.endsWith('/'), path).toBe(true);
}

let tmpDir: AbsolutePath;

beforeAll(async () => {
  tmpDir = Path.absolute({ path: await fs.mkdtemp(`${os.tmpdir()}/syscript-path-`) });
  await fs.mkdir(`${tmpDir}/a/b`, { recursive: true });
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('initialCwd, cwd', async () => {
  expectNoTrailingSlash(Path.initialCwd);
  expectNoTrailingSlash(await Path.cwd());
});

test('moduleDir', async () => {
  expectNoTrailingSlash(await Path.moduleDir(import.meta));
});

test('absolute', () => {
  const inputs = ['a/b/', 'a/b//', 'a//b///', './a/b/', 'a/b/../b/', `${tmpDir}/a/b/`, '/'];

  for (const path of inputs) {
    expectNoTrailingSlash(Path.absolute({ baseDir: tmpDir, path }));
    expectNoTrailingSlash(Path.absolute({ path }));
  }
});

test('real', async () => {
  for (const path of ['a/b/', 'a//b///', 'a/', '/']) {
    expectNoTrailingSlash(await Path.real(Path.absolute({ baseDir: tmpDir, path })));
  }
});

test('relative', () => {
  for (const path of ['a/b/', 'a/', '/', '../']) {
    const relative = Path.relative({
      baseDir: tmpDir,
      path: Path.absolute({ baseDir: tmpDir, path }),
    });

    expectNoTrailingSlash(relative.path);
    expectNoTrailingSlash(relative.baseDir);
    expectNoTrailingSlash(relative.absolutePath);
  }
});

test('dirname', () => {
  for (const path of ['a/b/', 'a/', '/']) {
    expectNoTrailingSlash(Path.dirname(Path.absolute({ baseDir: tmpDir, path })));
  }
});
