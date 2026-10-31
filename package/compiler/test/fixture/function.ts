function noop1(): void {}

function noop2() {
  return;
}

function noop3(): i32 {
  return i32(1);
}

function noop4(): i32 {
  return i32(1.0);
}

function noop5() {
  return 2;
}

function noop6() {
  return 2.1;
}

function noop7(): f32 {
  return f32(2.2);
}

function noop8(a: i32): void {}

function noop9(a: i32, b: f64): i32 {
  return i32(1);
}

function noop10(a: u8, b: i64, c: f32) {
  return;
}

function noop11(a: i32, b: i64) {
  return i64(a) + b;
}

function noop12() {
  return noop11(i32(3), i64(4));
}

declare function abs(x: i32): i32;

function noop13(): i32 {
  return abs(i32(5));
}

noop13();

export function noop14(): void {}

function noop15(): i32 {
  return noop16();
}

function noop16(): i32 {
  return i32(1);
}
