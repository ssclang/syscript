declare function exit(code: i32): void;

function less(a: i32, b: u32): boolean {
  return i64(a) < i64(b);
}

function lessEqual(a: u8, b: u8): boolean {
  return a <= b;
}

function greater(a: u64, b: u8): boolean {
  return a > u64(b);
}

function greaterEqual(a: i16, b: i16): boolean {
  return a >= b;
}

function equal(a: f64, b: f32): boolean {
  return a === f64(b);
}

function notEqual(a: i32, b: i64): boolean {
  return i64(a) !== b;
}

function sameBoolean(a: boolean, b: boolean, c: boolean): boolean {
  return (a !== b) === c;
}

const zero: i32 = i32(0);
let result: i32 = i32(0);

if (less(zero - i32(1), u32(4000000000))) {
  result = result + i32(1);
}

if (lessEqual(u8(3), u8(3))) {
  result = result + i32(2);
}

if (greater(u64(5), u8(3))) {
  result = result + i32(4);
}

if (greaterEqual(i16(3), i16(4))) {
  result = result + i32(8);
}

if (equal(0.5, f32(0.5))) {
  result = result + i32(16);
}

if (notEqual(i32(1), i64(2))) {
  result = result + i32(32);
}

if (sameBoolean(true, false, true)) {
  result = result + i32(64);
}

exit(result);
