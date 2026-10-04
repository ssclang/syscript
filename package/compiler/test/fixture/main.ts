import { add } from './add.js';
import { clock, exit } from './libc.js';

declare function abs(x: i32): i32;

declare function putchar(c: i32): i32;

function _date_now(): i64 {
  return clock() / 1_000;
}

function console_log(value: i32): i32 {
  let div: i32 = 1000000000;
  let started: i32 = 0;

  for (let i: i32 = 0; i < 10; i++) {
    const digit: i32 = value / div;
    const rest: i32 = digit % 10;

    if (rest !== 0) {
      started = 1;
    } else if (i === 9) {
      started = 1;
    }

    if (started === 1) {
      putchar(48 + rest);
    }

    div = div / 10;
  }

  return putchar(10);
}

export function sum(n: i32): i32 {
  let total: i32 = 0;

  for (let i: i32 = 0; i < n; i++) {
    total = add(total, i);
  }

  return total;
}

export function countdown(n: i32): i32 {
  let count: i32 = 0;

  while (n > 0) {
    count = count + 1;
    n = n - 1;
  }

  return count;
}

/** C의 `x != 0`은 NaN을 참으로 보지만 JS는 거짓으로 본다. 여기서는 JS를 따른다. */
export function nanIsFalsy(): i32 {
  const zero: f64 = 0;
  const nan: f64 = zero / zero;

  if (nan) {
    return 1;
  }

  return 0;
}

/** boolean은 조건에 그대로, 그 외 타입은 JS 규칙으로 판정한다. */
export function flags(n: i32, seen: boolean): i32 {
  let total: i32 = 0;

  if (n) {
    total = total + 1;
  }

  if (!seen) {
    total = total + 2;
  }

  if (seen) {
    total = total + 4;
  }

  return total;
}

/** `&&`, `||`는 조건 자리에서만 쓴다. 양쪽이 각각 JS 규칙으로 판정된다. */
export function logic(n: i32, seen: boolean): i32 {
  let total: i32 = 0;

  if (n > 0 && seen) {
    total = total + 1;
  }

  if (n > 100 || seen) {
    total = total + 2;
  }

  if (!(n > 0 && seen)) {
    total = total + 4;
  }

  const nan: f64 = 0 / 0;

  if (nan || n) {
    total = total + 8;
  }

  return total;
}

/** `break`는 루프를 끝내고 `continue`는 다음 회차로 넘어간다. */
export function oddSum(n: i32): i32 {
  let total: i32 = 0;

  for (let i: i32 = 0; i < 100; i++) {
    if (i >= n) {
      break;
    }

    if (i % 2 === 0) {
      continue;
    }

    total = total + i;
  }

  return total;
}

/** 진법과 지수 표기. 리터럴 원문을 어떻게 읽어야 하는지가 여기서 갈린다. */
export function literals(): i32 {
  const hex: i32 = 0xff;
  const bin: i32 = 0b1010;
  const oct: i32 = 0o17;
  const exp: i32 = 1e3;
  const under: i32 = 1_000;

  return hex + bin + oct + exp + under;
}

/** 사용자가 직접 쓴 괄호는 ParenthesizedExpression 노드로 들어온다. */
export function grouped(a: i32, b: i32): i32 {
  const scaled: i32 = (a + b) * 2;

  return scaled + (a % (b + 1));
}

/** 단항이 겹칠 때 `--`로 붙으면 감소 연산자가 되므로 방출기가 스스로 괄호를 친다. */
export function negate(x: i32): i32 {
  // prettier-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-unary-minus
  const twice: i32 = - -x;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-unary-minus
  const parens: i32 = -(-x);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-unary-minus
  return twice + parens + -x;
}

/** 자기 자신을 부른다. 전방 선언을 상단에 모아두어 정의 순서와 무관하다. */
export function fib(n: i32): i32 {
  if (n < 2) {
    return n;
  }

  return fib(n - 1) + fib(n - 2);
}

/** 서로를 부른다. */
function isEven(n: i32): i32 {
  if (n === 0) {
    return 1;
  }

  return isOdd(n - 1);
}

function isOdd(n: i32): i32 {
  if (n === 0) {
    return 0;
  }

  return isEven(n - 1);
}

export function main(): i32 {
  // const start = date_now();
  const total = abs(0 - sum(5));
  // const elapsed = date_now() - start;

  console_log(total);
  // console_log(elapsed);
  console_log(fib(20));
  console_log(isEven(10));
  console_log(nanIsFalsy());
  console_log(flags(1, true));
  console_log(logic(1, true));
  console_log(oddSum(10));

  return total;
  // return total + elapsed;
}

export function probe(a: f64) {
  const x = a;
  return x;
}

// for test
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function noExport(a: f64) {
  const x = a;
  return x;
}

// /** C 예약어와 겹치는 이름. TS에서는 합법이라 우리는 그대로 내보낸다. */
// export function register(signed: i32): i32 {
//   const long: i32 = signed;

//   return long;
// }

/** TS 기본 number. JS와 같은 f64로 내려간다. */
export function plainNumber(a: number): number {
  const num1: number = a * 2;
  const num2 = a * 4;
  const num3 = 6;

  return num1 + num2 + num3 + 8;
}

export function plainBoolean(a: boolean): boolean {
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  const bool1: boolean = !a;
  const bool2 = !bool1;
  const bool3 = true;

  return (bool1 !== bool2) === bool3;
}

// 종료 코드는 JS처럼 사용자 코드가 정한다. 최상단 실행문은 모듈 초기화 함수가 된다.
exit(main());
