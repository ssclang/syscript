import { assert } from '@syscript/share/util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { logWarn, printLine } from '~/log.js';
import { AppSourceFile } from '~/ts/ts-node.js';
import { File } from '~/util/file.js';

type PathLeakCheckOption = {
  binPath: string;
  /** 프로그램 전체의 소스 파일. `.d.ts`까지 넘긴다. */
  sourceFiles: readonly AppSourceFile[];
  /** 컴파일이 의존성 파일(`.d`)을 남긴 디렉터리. */
  codeDir: string;
  /** 소스 파일 위치 말고도 바이너리에 남으면 안 되는 경로. */
  sensitivePaths: readonly string[];
  debug: boolean;
};

type PathLeak = {
  path: string;
  encoding: 'utf8' | 'utf16le' | 'utf32le';
  offset: number;
};

/**
 * 링크를 마친 바이너리에 빌드 환경의 경로가 남았는지 본다. 모듈 이름은 id라 경로가 없지만,
 * include한 헤더의 `__FILE__`처럼 clang이 넣는 경로는 결과물을 봐야 잡힌다. 남았으면 경고만
 * 한다. 개발 중에는 바이너리를 실행해 볼 수 있어야 하고, 배포할지는 사용자가 정한다. 디버그
 * 정보에는 소스 위치가 들어가는 게 정상이라 디버그 빌드는 검사하지 않는다.
 */
export async function checkPathLeak(option: PathLeakCheckOption) {
  const { binPath, sourceFiles, codeDir, sensitivePaths, debug } = option;

  if (debug) {
    logWarn(`path leak check skipped in debug build`);
    printLine();
    return;
  }

  const includeFiles = await readIncludedFiles(codeDir);
  const paths = await resolvePaths([
    os.homedir(),
    ...sourceFiles.map((s) => path.dirname(s.realPath)),
    ...sourceFiles.map((s) => path.dirname(s.tsNode.fileName)),
    ...sourceFiles
      .flatMap((s) => s.getLinkDirectives())
      .filter((d) => d.type === 'path')
      .map((d) => d.libOrPath),
    ...includeFiles,
    ...sensitivePaths,
  ]);
  const leaks = findPathLeaks(await fs.readFile(binPath), paths);

  if (leaks.length) {
    const lines = leaks.map(
      (l) => `  ${l.path} (${l.encoding}, offset 0x${l.offset.toString(16)})`,
    );
    logWarn(`path leak in ${binPath}:\n${lines.join('\n')}`);
    printLine();
  }

  return leaks;
}

/**
 * 컴파일이 실제로 읽은 파일. clang이 `-MMD`로 오브젝트 옆에 남긴 `.d`를 모은다. 헤더가 다시
 * include한 헤더와 모듈을 거친 include까지 나오고, 시스템 헤더는 빠진다. include 지시문에
 * 적힌 헤더는 이 목록의 부분집합이다.
 */
async function readIncludedFiles(codeDir: string) {
  const entries = await fs.readdir(codeDir, { recursive: true });
  const dependencyFiles = entries.filter((e) => e.endsWith('.d')).map((e) => path.join(codeDir, e));
  const files = await Promise.all(dependencyFiles.map(parseDependencyFile));

  return files.flat();
}

/**
 * make 규칙(`target: dep dep \`) 형식의 의존성 파일에서 의존 파일 목록을 꺼낸다. 줄은 `\`로
 * 이어지고, 경로의 공백은 `\ `, `#`은 `\#`, `$`는 `$$`로 이스케이프된다.
 */
async function parseDependencyFile(dependencyFile: string) {
  const content = (await File.read(dependencyFile)).replaceAll('\\\n', ' ');
  const separator = content.indexOf(': ');

  assert(separator !== -1, `invalid dependency file: ${dependencyFile}`);

  return content
    .slice(separator + 2)
    .split(/(?<!\\)\s+/)
    .filter((token) => token)
    .map((token) => token.replaceAll('\\ ', ' ').replaceAll('\\#', '#').replaceAll('$$', '$'))
    .map((file) => path.resolve(file));
}

/**
 * 바이너리에 남으면 안 되는 경로. 빌드한 사람과 프로젝트를 드러내는 디렉터리들이다. 같은
 * 곳이 심볼릭 링크를 거친 경로와 실제 경로로 따로 찍힐 수 있어 둘 다 담는다(`/home` →
 * `/var/home` 등). 파일이면 그 디렉터리를 써서 옆의 경로까지 잡는다. 루트(`/`)는 모든 경로에
 * 걸리므로 뺀다.
 */
async function resolvePaths(paths: readonly string[]) {
  const pathSet = new Set<string>();

  for (const p of paths) {
    pathSet.add(p);

    if (!(await File.exists(p))) {
      continue;
    }

    // 심볼릭 링크를 따라간 실제 대상으로 파일인지 본다.
    const realPath = await fs.realpath(p);
    const isDirectory = (await fs.stat(realPath)).isDirectory();

    if (isDirectory) {
      pathSet.add(realPath);
    } else {
      pathSet.add(path.dirname(p));
      pathSet.add(path.dirname(realPath));
    }
  }

  const sortedPaths = pathSet
    .values()
    .filter((p) => path.parse(p).root !== p)
    .toArray()
    .sort((a, b) => {
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    });

  // 검사가 부분 문자열이라 앞의 후보로 시작하는 후보는 결과를 바꾸지 못한다(`/home/lsh/src` ⊃
  // `/home/lsh`). 정렬하면 그런 후보가 바로 뒤에 모이므로 마지막으로 남긴 후보와만 비교한다.
  const candidates: string[] = [];

  for (const p of sortedPaths) {
    const last = candidates.at(-1);

    if (last && p.startsWith(last)) {
      continue;
    }

    candidates.push(p);
  }

  return candidates;
}

/**
 * 바이너리 바이트에서 각 경로가 인코딩별로 처음 나오는 위치. 문자열 섹션만이 아니라 파일
 * 전체를 본다.
 */
function findPathLeaks(binary: Buffer, paths: readonly string[]): PathLeak[] {
  return paths
    .flatMap((p) =>
      encodePath(p).map(({ encoding, bytes }) => ({
        path: p,
        encoding,
        offset: binary.indexOf(bytes),
      })),
    )
    .filter((leak) => leak.offset !== -1);
}

/**
 * 경로가 바이너리에 들어가는 형태. `char`는 UTF-8, `char16_t`(`u""`)는 UTF-16, Linux의
 * `wchar_t`(`L""`)는 UTF-32다. 대상이 little-endian이라 LE만 본다.
 */
function encodePath(p: string) {
  // 문자열 순회는 코드 포인트 단위다. UTF-32는 코드 포인트마다 4바이트라 이 단위가 맞다.
  const codePoints: number[] = [];

  for (const char of p) {
    const codePoint = char.codePointAt(0);

    assert(codePoint !== undefined);

    codePoints.push(codePoint);
  }

  const utf32 = Buffer.alloc(codePoints.length * 4);

  codePoints.forEach((codePoint, i) => utf32.writeUInt32LE(codePoint, i * 4));

  return [
    { encoding: 'utf8', bytes: Buffer.from(p, 'utf8') },
    { encoding: 'utf16le', bytes: Buffer.from(p, 'utf16le') },
    { encoding: 'utf32le', bytes: utf32 },
  ] as const;
}
