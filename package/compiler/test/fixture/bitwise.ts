declare function exit(code: i32): void;

function and(a: u8, b: u8): u8 {
  return a & b;
}

function or(a: i32, b: u8): i32 {
  return a | i32(b);
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

const zero: i32 = i32(0);
let result: i32 = i32(0);

if (and(u8(12), u8(10)) === u8(8)) {
  result = result + i32(1);
}

if (or(i32(16), u8(3)) === i32(19)) {
  result = result + i32(2);
}

if (xor(u16(5), u16(3)) === u16(6)) {
  result = result + i32(4);
}

if (shiftLeft(u8(200), u8(1)) === u8(144)) {
  result = result + i32(8);
}

if (shiftRight(zero - i32(8), i32(1)) === zero - i32(4)) {
  result = result + i32(16);
}

if (unsignedShiftRight(zero - i32(1), i32(1)) === i32(2147483647)) {
  result = result + i32(32);
}

exit(result);
