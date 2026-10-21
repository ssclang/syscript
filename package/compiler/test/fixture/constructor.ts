declare function exit(code: i32): void;

function widen(v: i32): i64 {
  return i64(v);
}

function of(codePoint: u32): char {
  return char(codePoint);
}

function offset(c: char): u32 {
  return c - 65;
}

function widenChar(c: char, n: i32): i64 {
  return c + n;
}

let result: i32 = 0;

if (widen(-1) === -1) {
  result += 1;
}

if (u8(255) === 255) {
  result += 2;
}

if (f64(u32(7)) === 7) {
  result += 4;
}

if (of(65) === 'A') {
  result += 8;
}

if (char(0x1f44d) === '👍') {
  result += 16;
}

if (char('A') === 'A') {
  result += 32;
}

if (offset(of(67)) === 2) {
  result += 64;
}

if (widenChar(of(65), -66) === -1) {
  result += 128;
}

exit(result);
