declare function exit(code: i32): void;

function negate(a: u8): i16 {
  return -i16(a);
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
  return i64('-9223372036854775808');
}

function addNegative(a: i32): i32 {
  return a + i32(-1);
}

let result: i32 = i32(0);

if (negate(u8(200)) === i16(-200)) {
  result = result + i32(1);
}

if (negateFloat(f32(1.5)) === f32(-1.5)) {
  result = result + i32(2);
}

if (plus(i32(7)) === 7) {
  result = result + i32(4);
}

if (not(i32(0))) {
  result = result + i32(8);
}

if (complement(u8(5)) === u8(250)) {
  result = result + i32(16);
}

if (minimum() < i64('-9223372036854775807')) {
  result = result + i32(32);
}

if (addNegative(i32(5)) === i32(4)) {
  result = result + i32(64);
}

exit(result);
