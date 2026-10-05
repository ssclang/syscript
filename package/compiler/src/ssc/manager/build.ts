import { assert } from '@syscript/share/util';
import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import {
  cModuleLayout,
  hasCIncludes,
  renderEntryC,
  renderModuleHeader,
  renderModuleMap,
} from '~/c/c-module.js';
import { lower } from '~/c/lower.js';
import { printLine } from '~/log.js';
import { SscIdManager } from '~/ssc/manager/id.js';
import { App } from '~/ts/ts-app.js';
import { AppSourceFile } from '~/ts/ts-node.js';
import { TsParser } from '~/ts/ts-parserv2.js';
import { File } from '~/util/file.js';
import { Path } from '~/util/path.js';

declare const _sscTsserverPath: string | undefined;
declare const _sscPreludeDir: string | undefined;

export type SscBuildProfile = 'dev' | 'release' | 'test';

type SscBuildManagerOption = {
  outDir: string;
  profile: SscBuildProfile;
  idManager: SscIdManager;
};

type CompiledModule = {
  sourceFile: AppSourceFile;
  /** 모듈의 C 이름 공간에 쓰는 id. 진입점이 초기화 함수를 부를 때도 쓴다. */
  id: string;
  output: ReturnType<typeof lower>;
};

type EmitOption = {
  entryPath: string;
  /** 기본값은 확장자를 뗀 엔트리 파일 이름. */
  binName?: string;
  /**
   * 기본값 1. 우리가 내는 형태의 IR(지역 변수마다 alloca/load/store) 200모듈로 재보면
   * 0은 mem2reg가 꺼져 실행이 9.4배 느려 쓸 수 없다. 1과 2는 실행 0.39s : 0.25s,
   * 링크 0.20s : 0.36s라 아직 고를 만하다. 컴파일러가 더 완성되면 다시 재고 정한다.
   */
  optLevel?: '0' | '1' | '2' | '3';

  /** 켜면 `-g`로 디버그 정보를 남긴다. 아직 생성된 C 기준이라 원본과는 이어지지 않는다. */
  debug?: boolean;
};

const isDev = true;

export class SscBuildManager {
  readonly tsserverPath =
    typeof _sscTsserverPath === 'string' ?
      path.join(import.meta.dirname, _sscTsserverPath)
    : path.join(import.meta.dirname, '../../../../../../ssclang/TypeScript/built/local/tsc');

  readonly preludeDir =
    typeof _sscPreludeDir === 'string' ?
      path.join(import.meta.dirname, _sscPreludeDir)
    : path.join(import.meta.dirname, '../../../../../prelude/');
  readonly preludePath = path.join(this.preludeDir, 'prelude.d.ts');

  readonly outDir: string;
  readonly markerPath: string;
  readonly buildDir: string;
  readonly codeDir: string;
  readonly idManager: SscIdManager;

  constructor(option: SscBuildManagerOption) {
    this.outDir = option.outDir;
    this.markerPath = path.join(this.outDir, '.ssc');
    this.buildDir = path.join(this.outDir, 'build', option.profile);
    this.codeDir = path.join(this.buildDir, 'src');
    this.idManager = option.idManager;
  }

  async compile(inputEntryPath: string) {
    const tsserverPath = await Path.real(Path.absolute({ path: this.tsserverPath }));
    const preludePath = await Path.real(Path.absolute({ path: this.preludePath }));
    const entryPath = await Path.real(Path.absolute({ path: inputEntryPath }));
    const parser = await TsParser.init({ tsserverPath, preludePath, entryPath });
    const app = App.init('log', parser);
    const getModuleId = (path: string) => this.idManager.loadId(path);
    const option = { moduleId: getModuleId, prelude: app.preludeSourceFile };

    // 초기화 순서로 돌려준다. emit의 진입점이 이 순서대로 초기화 함수를 부른다.
    const modules = SscBuildManager.loadModules(app.entrySourceFile).map((s) => ({
      sourceFile: s,
      id: getModuleId(s.realPath),
      output: lower(s, option),
    }));

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (isDev) {
      printLine();
      for (const m of modules) {
        const { sourceFile, output } = m;
        sourceFile.debugPrint();
        printLine();
        console.log(output.renderC('<buildDir>'));
        printLine();
      }
    }

    // `ssc:link`의 C 소스도 모듈처럼 id로 오브젝트 이름을 짓는다. `id.json`에 남도록 여기서 발급한다.
    for (const directive of SscBuildManager.getUniqueLinkDirectives(app.sourceFiles)) {
      const { type, libOrPath } = directive;

      if (type === 'path' && libOrPath.endsWith('.c')) {
        getModuleId(libOrPath);
      }
    }

    // `modules`는 실행할 코드가 있는 파일뿐이다. `.d.ts`까지 필요한 쪽은 `app`을 쓴다.
    return { app, modules };
  }

  /**
   * IR을 파일로 떨구고 clang으로 실행 파일까지 만든다.
   *
   * ThinLTO를 기본으로 쓴다. 모듈을 파일 단위로 쪼개면 경계를 넘는 인라이닝이 막혀
   * 런타임이 크게 나빠지는데, ThinLTO는 요약 색인으로 필요한 함수만 각 모듈에 끌어와
   * 그 손해를 없앤다. 모듈별 작업이 유지되어 병렬 처리와 캐시가 그대로 가능하다.
   *
   * `buildDir`(`outDir/build/<profile>`) 아래를 이렇게 나눠 쓴다.
   *
   * - `src/` 생성한 C와 오브젝트. 매 빌드마다 비운다
   * - `module/` 모듈맵, 래퍼 헤더, 모듈 캐시
   * - `<binName>` 실행 파일
   */
  async emit(modules: readonly CompiledModule[], option: EmitOption) {
    const {
      entryPath,
      binName = path.basename(entryPath, path.extname(entryPath)),
      optLevel = '1',
      debug = false,
    } = option;
    const { buildDir, codeDir } = this;
    const binPath = path.join(buildDir, binName);
    const rootDir = File.commonDir(modules.map((m) => m.sourceFile.realPath));
    const baseFlags = [
      '-std=gnu23',
      `-O${optLevel}`,
      '-flto=thin',

      '-ffp-contract=off',
      '-Wno-parentheses-equality',

      // `.comment`에 clang 버전을 남기지 않는다. 시스템 crt 오브젝트가 남기는 GCC 버전과
      // `.annobin.notes`, `.gnu.build.attributes`는 링크 후에 따로 지워야 한다.
      // '-fno-ident',
    ];

    if (debug) {
      baseFlags.push('-g');
    }

    // 모듈맵과 모듈 캐시는 빌드 사이에 유지한다.
    const layout = cModuleLayout(buildDir);
    const compileFlags = [
      ...baseFlags,
      '-fmodules',
      `-fmodule-map-file=${layout.moduleMapPath}`,
      `-fmodules-cache-path=${layout.moduleCacheDir}`,

      // 오브젝트 옆에 실제로 include된 헤더 목록(`.d`)을 남긴다. 모듈을 거친 include도 나온다.
      '-MMD',
    ];

    await this.writeModules(modules, layout);
    await fs.rm(codeDir, { recursive: true, force: true });

    const oPaths: string[] = [];

    for (const { sourceFile, output } of modules) {
      const relativePath = path.relative(rootDir, sourceFile.realPath);
      const name = path.join(
        path.dirname(relativePath),
        path.basename(relativePath, path.extname(relativePath)),
      );
      const cPath = path.join(codeDir, `${name}.c`);
      const oPath = path.join(codeDir, `${name}.o`);

      await File.write(cPath, output.renderC(buildDir), true);
      SscBuildManager.run('clang', [...compileFlags, '-c', cPath, '-o', oPath]);

      oPaths.push(oPath);
    }

    // C `main`은 소스가 아니라 초기화 순서에서 나온다.
    const entryCPath = path.join(codeDir, 'ssc__main.c');
    const entryOPath = path.join(codeDir, 'ssc__main.o');

    await File.write(entryCPath, renderEntryC(modules.map((m) => m.id)), true);
    SscBuildManager.run('clang', [...compileFlags, '-c', entryCPath, '-o', entryOPath]);
    oPaths.push(entryOPath);

    // TODO: experimental: c 통합 poc 단계. 재설계 고려
    // `ssc:link`. `.c`는 생성 코드처럼 따로 컴파일하고, 나머지는 링크 명령에 그대로 넘긴다.
    // 정적인지 동적인지는 링커가 파일 형식을 보고 정한다.
    const [first] = modules;

    assert(first, 'no module to emit');

    const linkArgs: string[] = [];

    for (const { type, libOrPath } of SscBuildManager.getUniqueLinkDirectives(
      first.sourceFile.app.sourceFiles,
    )) {
      if (type === 'lib') {
        linkArgs.push(`-l${libOrPath}`);
        continue;
      }

      if (!libOrPath.endsWith('.c')) {
        linkArgs.push(libOrPath);
        continue;
      }

      // 소스는 제자리에서 절대 경로로 컴파일한다. 오브젝트는 id로 지어 같은 이름의 소스끼리 겹치지 않는다.
      const oPath = path.join(codeDir, 'link', `${this.idManager.loadId(libOrPath)}.o`);

      await fs.mkdir(path.dirname(oPath), { recursive: true });
      SscBuildManager.run('clang', [...compileFlags, '-c', libOrPath, '-o', oPath]);
      oPaths.push(oPath);
    }

    await fs.mkdir(path.dirname(binPath), { recursive: true });
    SscBuildManager.run('clang', [...baseFlags, ...oPaths, ...linkArgs, '-o', binPath]);

    return binPath;
  }

  /** 프로그램 전체 `.d.ts`의 `ssc:link`. 같은 대상이 여러 번 나오면 처음 것만 남긴다. */
  private static getUniqueLinkDirectives(sourceFiles: readonly AppSourceFile[]) {
    const set = new Set<string>();

    return sourceFiles
      .flatMap((s) => s.getLinkDirectives())
      .filter(({ type, libOrPath }) => {
        const key = `${type}:${libOrPath}`;

        if (set.has(key)) {
          return false;
        }

        set.add(key);

        return true;
      });
  }

  /**
   * 엔트리부터 import를 깊이 우선으로 돌며 `.d.ts`까지 모두 App에 등록하고, `.ts`를 초기화
   * 순서로 돌려준다. ES 모듈 평가 순서와 같아 순환 import는 방문 중인 파일을 건너뛴다.
   */
  private static loadModules(entry: AppSourceFile) {
    const modules: AppSourceFile[] = [];
    const visited = new Set<AppSourceFile>();

    const visit = (sourceFile: AppSourceFile) => {
      if (visited.has(sourceFile)) {
        return;
      }

      visited.add(sourceFile);
      sourceFile.loadImportedSourceFiles().forEach(visit);

      if (!sourceFile.isDeclarationFile) {
        modules.push(sourceFile);
      }
    };

    visit(entry);

    return modules;
  }

  /**
   * 프로그램 전체의 `.d.ts` 중 include 지시문이 있는 것을 모듈맵 하나에 담는다. clang은
   * TU가 include한 모듈만 빌드하므로 쓰이지 않는 항목은 비용이 없다. 모듈맵이나 래퍼가
   * 다시 쓰이면 내용이 같아도 모듈 캐시가 무효화되므로 바뀐 것만 쓴다.
   */
  private async writeModules(
    modules: readonly CompiledModule[],
    layout: ReturnType<typeof cModuleLayout>,
  ) {
    const [first] = modules;

    assert(first, 'no module to emit');

    const sourceFiles = first.sourceFile.app.sourceFiles
      .filter(hasCIncludes)
      .toSorted((a, b) => (a.realPath < b.realPath ? -1 : 1));

    const entries = sourceFiles.map((s) => ({
      sourceFile: s,
      id: this.idManager.loadId(s.realPath),
    }));

    for (const { sourceFile, id } of entries) {
      await File.writeIfChanged(layout.getHeaderPath(id), renderModuleHeader(sourceFile), true);
    }

    const moduleMap = renderModuleMap(entries.map((e) => e.id));

    await File.writeIfChanged(layout.moduleMapPath, moduleMap, true);
  }

  /** 진단은 clang이 색까지 입혀 그대로 내보내는 게 읽기 좋다. 우리는 짧게만 던진다. */
  private static run(command: string, args: readonly string[]) {
    const { status } = spawnSync(command, args, { stdio: 'inherit' });

    if (status !== 0) {
      throw new Error(`${[command, ...args].join(' ')} failed (exit ${status})`);
    }
  }
}
