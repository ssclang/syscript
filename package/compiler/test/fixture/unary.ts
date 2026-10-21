declare function exit(code: i32): void;

function negate(a: u8): i16 {
  return -a;
}

function negateFloat(a: f32): f32 {
  return -a;
}

function plus(a: i32): f64 {
  return +a;
}

function not(a: i32): boolean {
  return !a;
}

function complement(a: u8): u8 {
  return ~a;
}

function minimum(): i64 {
  return -9223372036854775808;
}

function addNegative(a: i32): i32 {
  return a + -1;
}

let result: i32 = 0;

if (negate(200) === -200) {
  result = result + 1;
}

if (negateFloat(1.5) === -1.5) {
  result = result + 2;
}

if (plus(7) === 7) {
  result = result + 4;
}

if (not(0)) {
  result = result + 8;
}

if (complement(5) === 250) {
  result = result + 16;
}

if (minimum() < -9223372036854775807) {
  result = result + 32;
}

if (addNegative(5) === 4) {
  result = result + 64;
}

exit(result);
