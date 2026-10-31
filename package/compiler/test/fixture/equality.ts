declare function exit(code: i32): void;

function isFive(x: i32 | undefined): boolean {
  return x === i32(5);
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
  return c === char('A');
}

function isTwo(x: f64 | i32): boolean {
  return x === 2;
}

const big: u64 = u64('18446744073709551615');
const minus: i64 = i64(-1);
let result: i32 = i32(0);

if (isFive(i32(5)) && !isFive(i32(6)) && !isFive(undefined)) {
  result += i32(1);
}

if (isHi('hi') && !isHi('ho') && !isHi(undefined)) {
  result += i32(2);
}

if (same(minus, minus) && !same(minus, big) && same(big, big)) {
  result += i32(4);
}

if (isTrue(true) && !isTrue(false) && !isTrue(undefined)) {
  result += i32(8);
}

if (isA(char(65)) && !isA(char(66)) && !isA(undefined)) {
  result += i32(16);
}

if (isTwo(2) && isTwo(2.0) && !isTwo(2.5)) {
  result += i32(32);
}

exit(result);
