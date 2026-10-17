import cp from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { SscBuildManager } from '~/ssc/manager/build.js';
import { PathResolver } from '~/util/path-resolver.js';

const clang = PathResolver.clangPath();
const compileFlags = SscBuildManager.clangCompileFlag();
const preludeDir = PathResolver.preludeDir();

let buildDir: string;

beforeAll(async () => {
  buildDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ssc-prelude-'));
  cp.execFileSync(clang, [
    ...compileFlags,
    '--precompile',
    path.join(preludeDir, 'prelude.cppm'),
    '-o',
    path.join(buildDir, 'ssc.pcm'),
  ]);
  cp.execFileSync(clang, [
    ...compileFlags,
    '-c',
    path.join(buildDir, 'ssc.pcm'),
    '-o',
    path.join(buildDir, 'ssc.o'),
  ]);
});

afterAll(async () => {
  await fs.rm(buildDir, { recursive: true, force: true });
});

test.each(['rc'])('%s', (name) => {
  const objectPath = path.join(buildDir, `${name}.o`);
  const binaryPath = path.join(buildDir, name);

  cp.execFileSync(clang, [
    ...compileFlags,
    `-fmodule-file=ssc=${path.join(buildDir, 'ssc.pcm')}`,
    '-c',
    path.join(preludeDir, 'test', `${name}.cpp`),
    '-o',
    objectPath,
  ]);
  cp.execFileSync(clang, [
    ...SscBuildManager.clangEmitFlag(),
    objectPath,
    path.join(buildDir, 'ssc.o'),
    '-o',
    binaryPath,
  ]);

  expect(cp.spawnSync(binaryPath).status).toBe(0);
});
