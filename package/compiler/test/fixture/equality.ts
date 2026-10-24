declare function exit(code: i32): void;

function isFive(x: i32 | undefined): boolean {
  return x === 5;
}

function isHi(s: string | undefined): boolean {
  return s === 'hi';
}

function same(a: i64 | u64, b: i64 | u64): boolean {
  return a === b;
}

function isTrue(b: boolean | undefined): boolean {
  return b === true;
}

function isA(c: char | undefined): boolean {
  return c === 'A';
}

function isTwo(x: f64 | i32): boolean {
  return x === 2;
}

const big: u64 = 18446744073709551615;
const minus: i64 = -1;
let result: i32 = 0;

if (isFive(5) && !isFive(6) && !isFive(undefined)) {
  result += 1;
}

if (isHi('hi') && !isHi('ho') && !isHi(undefined)) {
  result += 2;
}

if (same(minus, minus) && !same(minus, big) && same(big, big)) {
  result += 4;
}

if (isTrue(true) && !isTrue(false) && !isTrue(undefined)) {
  result += 8;
}

if (isA(char(65)) && !isA(char(66)) && !isA(undefined)) {
  result += 16;
}

if (isTwo(2) && isTwo(2.0) && !isTwo(2.5)) {
  result += 32;
}

exit(result);
