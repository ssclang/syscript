declare function exit(code: i32): void;

let calls: i32 = 0;

function count(value: i32): i32 {
  calls = calls + 1;

  return value;
}

function and(a: i32, b: i32): i32 {
  return count(a) && b;
}

function or(a: i32, b: u8): i32 {
  return a || b;
}

function orFloat(a: f64, b: i32): f64 {
  return a || b;
}

function both(a: boolean, b: boolean): boolean {
  return a && b;
}

const zero: f64 = 0;
const n: i32 = 0;
const x: f64 = 0.5;
let result: i32 = 0;

if (and(0, 5) === 0) {
  result = result + 1;
}

if (and(3, 5) === 5) {
  result = result + 2;
}

if (or(0, 7) === 7) {
  result = result + 4;
}

if (or(4, 7) === 4) {
  result = result + 8;
}

if (orFloat(zero / zero, 9) === 9) {
  result = result + 16;
}

if (both(true, true)) {
  result = result + 32;
}

if (calls === 2) {
  result = result + 64;
}

if (n || x) {
  result = result + 128;
}

exit(result);
