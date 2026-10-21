declare function exit(code: i32): void;

function and(a: u8, b: u8): u8 {
  return a & b;
}

function or(a: i32, b: u8): i32 {
  return a | b;
}

function xor(a: u16, b: u16): u16 {
  return a ^ b;
}

function shiftLeft(a: u8, b: u8): u8 {
  return a << b;
}

function shiftRight(a: i32, b: i32): i32 {
  return a >> b;
}

function unsignedShiftRight(a: i32, b: i32): i32 {
  return a >>> b;
}

const zero: i32 = 0;
let result: i32 = 0;

if (and(12, 10) === 8) {
  result = result + 1;
}

if (or(16, 3) === 19) {
  result = result + 2;
}

if (xor(5, 3) === 6) {
  result = result + 4;
}

if (shiftLeft(200, 1) === 144) {
  result = result + 8;
}

if (shiftRight(zero - 8, 1) === zero - 4) {
  result = result + 16;
}

if (unsignedShiftRight(zero - 1, 1) === 2147483647) {
  result = result + 32;
}

exit(result);
