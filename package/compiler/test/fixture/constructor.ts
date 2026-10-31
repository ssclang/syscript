declare function exit(code: i32): void;

function widen(v: i32): i64 {
  return i64(v);
}

function of(codePoint: u32): char {
  return char(codePoint);
}

function offset(c: char): u32 {
  return u32(c) - u32(65);
}

function widenChar(c: char, n: i32): i64 {
  return i64(c) + i64(n);
}

let result: i32 = i32(0);

if (widen(i32(-1)) === i64(-1)) {
  result += i32(1);
}

if (u8(255) === u8(255)) {
  result += i32(2);
}

if (f64(u32(7)) === 7) {
  result += i32(4);
}

if (of(u32(65)) === char('A')) {
  result += i32(8);
}

if (char(0x1f44d) === char('👍')) {
  result += i32(16);
}

if (char('A') === char('A')) {
  result += i32(32);
}

if (offset(of(u32(67))) === u32(2)) {
  result += i32(64);
}

if (widenChar(of(u32(65)), i32(-66)) === i64(-1)) {
  result += i32(128);
}

exit(result);
