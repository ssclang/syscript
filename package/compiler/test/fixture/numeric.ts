declare function exit(code: i32): void;

function twice(v: i32 & {}): i32 {
  return v + v;
}

function u8s(a: u8, b: u8): boolean {
  return a + b === 255 && a - b === 145 && a * 1 === 200;
}

function i32s(a: i32, b: i32): boolean {
  return a / b === -2 && a % b === -1;
}

function minimumRemainder(a: i32, b: i32): i32 {
  return a % b;
}

const half = 1 / 2;
const big = 1e20;
const small: f32 = 0.1;
const overflow = 1e1000;
const underflow = 1e-1000;
const overflow32: f32 = 1e39;
const exponent: i32 = 1e3;
const negative: f32 = -1.5;
const fromUnderflow: i32 = 1e-1000;
let result: i32 = 0;

if (half === 0.5) {
  result += 1;
}

if (twice(21) === 42) {
  result += 2;
}

if (u8s(200, 55) && i32s(-5, 2) && minimumRemainder(-2147483648, -1) === 0) {
  result += 4;
}

if (big === 1e20 && small === 0.1 && overflow > 1e308 && underflow === 0 && overflow32 > 1e38 && exponent === 1000 && negative === -1.5 && fromUnderflow === 0) {
  result += 8;
}

exit(result);
