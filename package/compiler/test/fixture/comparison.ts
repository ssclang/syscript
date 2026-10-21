declare function exit(code: i32): void;

function less(a: i32, b: u32): boolean {
  return a < b;
}

function lessEqual(a: u8, b: u8): boolean {
  return a <= b;
}

function greater(a: u64, b: u8): boolean {
  return a > b;
}

function greaterEqual(a: i16, b: i16): boolean {
  return a >= b;
}

function equal(a: f64, b: f32): boolean {
  return a === b;
}

function notEqual(a: i32, b: i64): boolean {
  return a !== b;
}

const zero: i32 = 0;
let result: i32 = 0;

if (less(zero - 1, 4000000000)) {
  result = result + 1;
}

if (lessEqual(3, 3)) {
  result = result + 2;
}

if (greater(5, 3)) {
  result = result + 4;
}

if (greaterEqual(3, 4)) {
  result = result + 8;
}

if (equal(0.5, 0.5)) {
  result = result + 16;
}

if (notEqual(1, 2)) {
  result = result + 32;
}

exit(result);
