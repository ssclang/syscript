declare function exit(code: i32): void;

function find(target: i32): i32 | undefined {
  if (target > 10) {
    return undefined;
  }

  return target * 2;
}

function use(target: i32): i32 {
  const found = find(target);

  if (found === undefined) {
    return -1;
  }

  return found + 1;
}

let last: i32 | undefined = undefined;

function remember(a: i32): i32 {
  let x: i32 | undefined = undefined;

  if (a > 0) {
    x = a;
    last = a;
  }

  if (x !== undefined) {
    return x;
  }

  return 0;
}

function lastOr(fallback: i32): i32 {
  if (last === undefined) {
    return fallback;
  }

  return last;
}

function orZero(v: i32 | undefined): i32 {
  if (v === undefined) {
    return 0;
  }

  return v;
}

function small(a: u8): i32 {
  return orZero(a) + orZero(undefined) + orZero(300);
}

function next(v: i32 | i64): i64 {
  return v + 1;
}

function both(a: i32, b: i64): i64 {
  return next(a) + next(b);
}

function score(x: i32 | boolean | undefined): i32 {
  if (x === undefined) {
    return 0;
  }

  if (typeof x === 'boolean') {
    if (x) {
      return 1;
    }

    return 2;
  }

  return x + 10;
}

function widen(v: i32 | undefined): i32 | boolean | undefined {
  return v;
}

function orNegative(x: i32 | null): i32 {
  if (x === null) {
    return -1;
  }

  return x;
}

function kind(x: i32 | null | undefined): i32 {
  if (x === undefined) {
    return 0;
  }

  if (typeof x === 'object') {
    return 1;
  }

  return 2;
}

function mixed(x: f32 | i32 | f64 | u32): f64 {
  return x + 0.5;
}

const nothing = undefined;

function none(): undefined {
  return nothing;
}

function nullCount(x: null): i32 {
  return 1;
}

function wrap(): i32 | undefined {
  const value = none();

  return value;
}

function unwrap(a: i32): i32 {
  let x: i32 | null = null;

  if (a > 0) {
    x = a;
  }

  if (x === null) {
    const y: null = x;

    return nullCount(y);
  }

  return 0;
}

let result: i32 = 0;

if (use(3) === 7 && use(20) === -1) {
  result += 1;
}

if (lastOr(9) === 9 && remember(5) === 5 && remember(-1) === 0 && lastOr(9) === 5) {
  result += 2;
}

if (small(7) === 307) {
  result += 4;
}

if (both(1, 10) === 13) {
  result += 8;
}

if (score(undefined) === 0 && score(true) === 1 && score(false) === 2 && score(5) === 15 && score(widen(7)) === 17 && score(widen(undefined)) === 0) {
  result += 16;
}

if (orNegative(null) === -1 && orNegative(4) === 4 && kind(undefined) === 0 && kind(null) === 1 && kind(7) === 2) {
  result += 32;
}

const smallValue: u8 = 2;
const negative: i8 = -3;

if (mixed(smallValue) === 2.5 && mixed(negative) === -2.5 && mixed(1.5) === 2) {
  result += 64;
}

if (wrap() === undefined && nullCount(null) === 1 && unwrap(-1) === 1 && unwrap(1) === 0) {
  result += 128;
}

exit(result);
