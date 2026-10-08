import { includes, sscAllTypes } from '~/ssc/type.js';
import { NodeIdentifier } from '~/ts/ts-node.js';

/**
 * C 키워드. 표준 판본별로 나눠 적는다. 밑줄로 시작하는 철자도 TS에서는 합법인 식별자라
 * 같이 담는다. 전처리기 지시자 이름(`#embed`, `#warning` 등)은 `#` 뒤에서만 의미가
 * 있어 식별자와 겹치지 않으므로 뺐다.
 *
 * 생성하는 이름에 모두 `ssc__` 접두어가 붙어 이 이름들을 막을 필요는 없어졌다. 이 이름들로
 * 선언해도 C가 깨지지 않는지 테스트가 확인한다.
 *
 * https://en.cppreference.com/w/c/keyword
 */
export const cKeywords = [
  // region C89/C90
  'auto',
  'break',
  'case',
  'char',
  'const',
  'continue',
  'default',
  'do',
  'double',
  'else',
  'enum',
  'extern',
  'float',
  'for',
  'goto',
  'if',
  'int',
  'long',
  'register',
  'return',
  'short',
  'signed',
  'sizeof',
  'static',
  'struct',
  'switch',
  'typedef',
  'union',
  'unsigned',
  'void',
  'volatile',
  'while',

  // region C99
  'inline',
  'restrict',
  '_Bool',
  '_Complex',
  '_Imaginary',
  '_Pragma',

  // region C11
  '_Alignas',
  '_Alignof',
  '_Atomic',
  '_Generic',
  '_Noreturn',
  '_Static_assert',
  '_Thread_local',

  // region C23
  'alignas', // _Alignas의 다른 철자
  'alignof', // _Alignof의 다른 철자
  'bool', // _Bool의 다른 철자
  'constexpr',
  'false',
  'nullptr',
  'static_assert', // _Static_assert의 다른 철자
  'thread_local', // _Thread_local의 다른 철자
  'true',
  'typeof',
  'typeof_unqual',
  '_BitInt',
  '_Decimal32',
  '_Decimal64',
  '_Decimal128',

  // region 조건부 지원 확장. `-std=gnu23`에서 키워드가 된다.
  'asm',
  'fortran',

  // region `-std=gnu23`에서 미리 정의되는 매크로. 표준 이전 Unix 컴파일러의 관례다.
  'linux',
  'unix',

  // region 링크에서 특별한 이름. 실행 파일의 진입점이다.
  'main',
] as const;

/**
 * TS 타입 이름을 C 타입 이름으로 바꾼다.
 * prelude가 정의한 타입은 C에서 `ssc__type__` 접두어를 붙인 typedef로 쓴다. 다른 C 헤더의
 * 같은 이름 typedef나 매크로(`boolean`, `f64` 등)와 겹치지 않는다. `void`는 C 타입 그대로다.
 */
export function toCTypeName(name: string) {
  if (name.startsWith('union:')) {
    return 'ssc__type__union';
  }

  if (!includes(sscAllTypes, name)) {
    throw new Error(`not implemented type: ${name}`);
  }

  if (name === 'void') {
    return name;
  }

  return `ssc__type__${name}`;
}

/**
 * 원본 이름. syscript가 만드는 C 이름은 모두 `ssc__` 접두어가 붙어 C 키워드나 헤더와 겹치지
 * 않으므로, 사용자가 그 접두어를 쓰는 것만 막는다. 접두어 없이 쓰이는 건 d.ts가 선언한 C
 * 함수 이름뿐이고 이는 실제 C 이름이다.
 */
export function cName(identifier: NodeIdentifier) {
  const { text } = identifier;

  if (text.startsWith('ssc__')) {
    throw new Error(`${identifier.location()}: '${text}' is reserved in Syscript`);
  }

  return text;
}
