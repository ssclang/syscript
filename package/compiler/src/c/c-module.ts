import path from 'path';
import { AppSourceFile } from '~/ts/ts-node.js';

/*
 * include 지시문이 있는 `.d.ts`는 clang 모듈 하나가 된다. 지시문의 헤더를 순서대로 담은
 * 래퍼 헤더를 만들고 모듈이 그 래퍼를 감싼다. 헤더가 바꾼 pragma 상태는 모듈 밖으로
 * 새지 않는다.
 */

/** `buildDir` 아래 모듈 파일의 배치. 렌더와 emit이 같은 규칙을 쓴다. */
export function cModuleLayout(buildDir: string) {
  const moduleDir = path.join(buildDir, 'module');

  return {
    moduleDir,
    moduleMapPath: path.join(moduleDir, 'ssc.modulemap'),
    moduleCacheDir: path.join(moduleDir, 'cache'),
    /** 래퍼 헤더의 절대 경로. 래퍼를 쓰는 emit과 include하는 렌더가 같은 경로를 쓴다. */
    getHeaderPath: (id: string) => path.join(moduleDir, cModuleHeader(id)),
  };
}

export function hasCIncludes(sourceFile: AppSourceFile) {
  return sourceFile.getIncludeDirectives().length > 0;
}

/** 모듈 디렉터리 기준 래퍼 헤더 경로. 모듈맵, 캐시와 섞이지 않게 `header/`에 모은다. */
export function cModuleHeader(id: string) {
  return `header/${id}.h`;
}

/**
 * 모듈 하나의 C 이름 공간. 이 이름 자체는 최상단 실행문을 담는 초기화 함수다. id가 32자
 * 고정이라 뒤에 무엇이 붙어도 모듈 경계가 모호하지 않다.
 */
export function cModuleName(id: string) {
  return `ssc__module_${id}`;
}

/** 모듈에 정의된 함수의 C 이름. 모듈마다 이름 공간이 나뉘어 다른 모듈이나 헤더와 겹치지 않는다. */
export function cModuleFunctionName(id: string, name: string) {
  return `${cModuleName(id)}_fn__${name}`;
}

/**
 * 모듈의 최상위 변수의 C 이름. 최상위 변수는 모듈에 하나씩이고 가려지지 않으니 번호 대신
 * `top`을 둔다. 다른 모듈도 이름만으로 같은 C 이름을 만들 수 있다.
 */
export function cModuleVariableName(id: string, name: string) {
  return `${cModuleName(id)}_var_top__${name}`;
}

/**
 * 지역 변수와 매개변수의 C 이름. 모듈마다 카운터 하나로 선언을 만나는 순서대로 1부터 번호를
 * 붙여, C의 가리기(shadowing)에 기대지 않는다. 좁혀진 자리에서도 바깥 선언의 이름이 그대로
 * 보이고, 콜백이나 익명 함수가 생겨도 겹치지 않는다.
 */
export function cModuleLocalVariableName(id: string, index: number, name: string) {
  return `${cModuleName(id)}_var_${index}__${name}`;
}

/**
 * 태그 값. 0으로 채워진 메모리(초깃값 없는 전역, `calloc`)가 그대로 초기화 전이 되도록 0을
 * 초기화 전에 둔다. 초기화를 빠뜨려도 값으로 읽히지 않고 TDZ로 드러난다.
 */
export enum CTag {
  Uninitialized = 0,
  Value = 1,
  Undefined = 2,
  Null = 3,
}

/** 최상위 변수의 태그. 선언 전에 접근될 수 있는 변수에만 있다. */
export function cModuleTagName(id: string, name: string) {
  return `${cModuleName(id)}_tag_top__${name}`;
}

/**
 * C `main`을 담은 진입점. 초기화 함수를 받은 순서대로 한 번씩 호출한다. 순서는 import를
 * 깊이 우선으로 돈 결과라 JS의 모듈 평가 순서와 같다. 종료 코드는 사용자 코드가 `exit`로
 * 정하고, 끝까지 가면 JS처럼 0이다.
 */
export function renderEntryC(moduleIds: readonly string[]) {
  const inits = moduleIds.map(cModuleName);

  return `
// entry

${inits.map((name) => `void ${name}(void);`).join('\n')}

int main(void) {
${inits.map((name) => `  ${name}();`).join('\n')}
  return 0;
}
`.trimStart();
}

export function renderModuleHeader(sourceFile: AppSourceFile) {
  return sourceFile
    .getIncludeDirectives()
    .map((i) => (i.type === 'lib' ? `#include <${i.libOrPath}>` : `#include "${i.libOrPath}"`))
    .join('\n');
}

/**
 * 모듈 이름과 래퍼 헤더 모두 모듈 id로 짓는다. 경로는 `id.json`에만 남고 모듈맵과 모듈
 * 캐시에는 퍼지지 않는다. id는 숫자로 시작할 수 있어 식별자가 아니므로 문자열로 감싼다.
 */
export function renderModuleMap(moduleIds: readonly string[]) {
  return moduleIds
    .map((id) =>
      `
module "${id}" {
  header "${cModuleHeader(id)}"
  export *
}
`.trim(),
    )
    .join('\n\n');
}
