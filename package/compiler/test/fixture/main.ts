import { add } from './add.js';
import { clock, exit } from './libc.js';

declare function abs(x: i32): i32;

function date_now(): i64 {
  return clock() / i64(1_000);
}

export function sum(n: i32): i32 {
  let total: i32 = i32(0);

  for (let i: i32 = i32(0); i < n; i++) {
    total = add(total, i);
  }

  return total;
}

export function countdown(n: i32): i32 {
  let count: i32 = i32(0);

  while (n > i32(0)) {
    count = count + i32(1);
    n = n - i32(1);
  }

  return count;
}

/** C의 `x != 0`은 NaN을 참으로 보지만 JS는 거짓으로 본다. 여기서는 JS를 따른다. */
export function nanIsFalsy(): i32 {
  const zero: f64 = 0;
  const nan: f64 = zero / zero;

  if (nan) {
    return i32(1);
  }

  return i32(0);
}

/** boolean은 조건에 그대로, 그 외 타입은 JS 규칙으로 판정한다. */
export function flags(n: i32, seen: boolean): i32 {
  let total: i32 = i32(0);

  if (n) {
    total = total + i32(1);
  }

  if (!seen) {
    total = total + i32(2);
  }

  if (seen) {
    total = total + i32(4);
  }

  return total;
}

/** `&&`, `||`는 조건 자리에서만 쓴다. 양쪽이 각각 JS 규칙으로 판정된다. */
export function logic(n: i32, seen: boolean): i32 {
  let total: i32 = i32(0);

  if (n > i32(0) && seen) {
    total = total + i32(1);
  }

  if (n > i32(100) || seen) {
    total = total + i32(2);
  }

  if (!(n > i32(0) && seen)) {
    total = total + i32(4);
  }

  const nan: f64 = 0 / 0;

  if (nan || f64(n)) {
    total = total + i32(8);
  }

  return total;
}

/** `break`는 루프를 끝내고 `continue`는 다음 회차로 넘어간다. */
export function oddSum(n: i32): i32 {
  let total: i32 = i32(0);

  for (let i: i32 = i32(0); i < i32(100); i++) {
    if (i >= n) {
      break;
    }

    if (i % i32(2) === i32(0)) {
      continue;
    }

    total = total + i;
  }

  return total;
}

/** 진법과 지수 표기. 리터럴 원문을 어떻게 읽어야 하는지가 여기서 갈린다. */
export function literals(): i32 {
  const hex: i32 = i32(0xff);
  const bin: i32 = i32(0b1010);
  const oct: i32 = i32(0o17);
  const exp: i32 = i32(1e3);
  const under: i32 = i32(1_000);

  return hex + bin + oct + exp + under;
}

/** 사용자가 직접 쓴 괄호는 ParenthesizedExpression 노드로 들어온다. */
export function grouped(a: i32, b: i32): i32 {
  const scaled: i32 = (a + b) * i32(2);

  return scaled + (a % (b + i32(1)));
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
  if (n < i32(2)) {
    return n;
  }

  return fib(n - i32(1)) + fib(n - i32(2));
}

/** 서로를 부른다. */
function isEven(n: i32): i32 {
  if (n === i32(0)) {
    return i32(1);
  }

  return isOdd(n - i32(1));
}

function isOdd(n: i32): i32 {
  if (n === i32(0)) {
    return i32(0);
  }

  return isEven(n - i32(1));
}

export function main(): i32 {
  // const start = date_now();
  const total = abs(i32(0) - sum(i32(5)));
  // const elapsed = date_now() - start;

  console.log(total);
  // console.log(elapsed);
  console.log(fib(i32(20)));
  console.log(isEven(i32(10)));
  console.log(nanIsFalsy());
  console.log(flags(i32(1), true));
  console.log(logic(i32(1), true));
  console.log(oddSum(i32(10)));

  return total;
  // return total + elapsed;
}

export function probe(a: f64) {
  const x = a;
  return x;
}

// for test
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

date_now();
noExport(0);

// 종료 코드는 JS처럼 사용자 코드가 정한다. 최상단 실행문은 모듈 초기화 함수가 된다.
exit(main());
