declare function exit(code: i32): void;

let calls: i32 = i32(0);

function count(value: i32): i32 {
  calls = calls + i32(1);

  return value;
}

function and(a: i32, b: i32): i32 {
  return count(a) && b;
}

function or(a: i32, b: u8): i32 {
  return a || i32(b);
}

function orFloat(a: f64, b: i32): f64 {
  return a || f64(b);
}

function both(a: boolean, b: boolean): boolean {
  return a && b;
}

const zero: f64 = 0;
const n: i32 = i32(0);
const x: f64 = 0.5;
let result: i32 = i32(0);

if (and(i32(0), i32(5)) === i32(0)) {
  result = result + i32(1);
}

if (and(i32(3), i32(5)) === i32(5)) {
  result = result + i32(2);
}

if (or(i32(0), u8(7)) === i32(7)) {
  result = result + i32(4);
}

if (or(i32(4), u8(7)) === i32(4)) {
  result = result + i32(8);
}

if (orFloat(zero / zero, i32(9)) === 9) {
  result = result + i32(16);
}

if (both(true, true)) {
  result = result + i32(32);
}

if (calls === i32(2)) {
  result = result + i32(64);
}

if (f64(n) || x) {
  result = result + i32(128);
}

exit(result);
