declare function exit(code: i32): void;

function isA(c: char): boolean {
  return c === 'A';
}

function same(a: char, b: char): boolean {
  return a === b;
}

function isUpper(c: char): boolean {
  return 'A' <= c && c <= 'Z';
}

function isCodeA(c: char): boolean {
  return c === 65;
}

function next(c: char): u32 {
  return c + 1;
}

function digit(c: char): u32 {
  return c - 0x30;
}

function widen(c: char): boolean {
  const a: u32 = c;
  const b: u64 = c;
  const d: i64 = c;
  const e: f64 = c;

  return a === 65 && b === 65 && d === 65 && e === 65;
}

function code(v: u32): u32 {
  return v;
}

function codeOr(c: char | undefined, fallback: u32): u32 {
  if (c === undefined) {
    return fallback;
  }

  return c;
}

function kind(c: char | boolean): i32 {
  if (typeof c === 'number') {
    return 1;
  }

  return 2;
}

const hangul: char = '한';
const emoji: char = '👍';
const literalU32: u32 = 'A';
const literalU64: u64 = 'A';
const literalI64: i64 = '한';
const literalF64: f64 = '👍';
let result: i32 = 0;

if (isA('A') && !isA('B')) {
  result += 1;
}

if (hangul === '한' && same(emoji, '\u{1F44D}') && same(emoji, '👍') && same('\'', "'")) {
  result += 2;
}

if (isUpper('Q') && !isUpper('q') && isCodeA('A')) {
  result += 4;
}

if (next('A') === 66 && digit('7') === 7) {
  result += 8;
}

if (widen('A') && literalU32 === 65 && literalU64 === 65 && literalI64 === 54620 && literalF64 === 128077 && code('A') === 65) {
  result += 16;
}

if (codeOr('A', 0) === 65 && codeOr(undefined, 7) === 7 && kind('A') === 1 && kind(true) === 2) {
  result += 32;
}

exit(result);
