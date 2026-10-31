declare function exit(code: i32): void;

function isA(c: char): boolean {
  return c === char('A');
}

function same(a: char, b: char): boolean {
  return a === b;
}

function isUpper(c: char): boolean {
  return char('A') <= c && c <= char('Z');
}

function isCodeA(c: char): boolean {
  return u32(c) === u32(65);
}

function next(c: char): u32 {
  return u32(c) + u32(1);
}

function digit(c: char): u32 {
  return u32(c) - u32(0x30);
}

function widen(c: char): boolean {
  const a: u32 = u32(c);
  const b: u64 = u64(c);
  const d: i64 = i64(c);
  const e: f64 = f64(c);

  return a === u32(65) && b === u64(65) && d === i64(65) && e === 65;
}

function code(v: u32): u32 {
  return v;
}

function codeOr(c: char | undefined, fallback: u32): u32 {
  if (c === undefined) {
    return fallback;
  }

  return u32(c);
}

function kind(c: char | boolean): i32 {
  if (typeof c === 'number') {
    return i32(1);
  }

  return i32(2);
}

const hangul: char = char('한');
const emoji: char = char('👍');
const literalU32: u32 = u32(char('A'));
const literalU64: u64 = u64(char('A'));
const literalI64: i64 = i64(char('한'));
const literalF64: f64 = f64(char('👍'));
let result: i32 = i32(0);

if (isA(char('A')) && !isA(char('B'))) {
  result += i32(1);
}

if (hangul === char('한') && same(emoji, char('\u{1F44D}')) && same(emoji, char('👍')) && same(char('\''), char("'"))) {
  result += i32(2);
}

if (isUpper(char('Q')) && !isUpper(char('q')) && isCodeA(char('A'))) {
  result += i32(4);
}

if (next(char('A')) === u32(66) && digit(char('7')) === u32(7)) {
  result += i32(8);
}

if (widen(char('A')) && literalU32 === u32(65) && literalU64 === u64(65) && literalI64 === i64(54620) && literalF64 === 128077 && code(u32(char('A'))) === u32(65)) {
  result += i32(16);
}

if (codeOr(char('A'), u32(0)) === u32(65) && codeOr(undefined, u32(7)) === u32(7) && kind(char('A')) === i32(1) && kind(true) === i32(2)) {
  result += i32(32);
}

exit(result);
