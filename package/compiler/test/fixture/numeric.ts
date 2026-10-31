declare function exit(code: i32): void;

function twice(v: i32 & {}): i32 {
  return v + v;
}

function u8s(a: u8, b: u8): boolean {
  return a + b === u8(255) && a - b === u8(145) && a * u8(1) === u8(200);
}

function i32s(a: i32, b: i32): boolean {
  return a / b === i32(-2) && a % b === i32(-1);
}

function minimumRemainder(a: i32, b: i32): i32 {
  return a % b;
}

const half = 1 / 2;
const big = 1e20;
const small: f32 = f32(0.1);
const overflow = 1e308 * 10;
const underflow = 1e-1000;
const overflow32: f32 = f32(1e39);
const exponent: i32 = i32(1e3);
const negative: f32 = f32(-1.5);
const fromUnderflow: i32 = i32(1e-1000);
let result: i32 = i32(0);

if (half === 0.5) {
  result += i32(1);
}

if (twice(i32(21)) === i32(42)) {
  result += i32(2);
}

if (u8s(u8(200), u8(55)) && i32s(i32(-5), i32(2)) && minimumRemainder(i32(-2147483648), i32(-1)) === i32(0)) {
  result += i32(4);
}

if (big === 1e20 && small === f32(0.1) && overflow > 1e308 && underflow === 0 && overflow32 > f32(1e38) && exponent === i32(1000) && negative === f32(-1.5) && fromUnderflow === i32(0)) {
  result += i32(8);
}

exit(result);
