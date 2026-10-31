declare function exit(code: i32): void;

function find(target: i32): i32 | undefined {
  if (target > i32(10)) {
    return undefined;
  }

  return target * i32(2);
}

function use(target: i32): i32 {
  const found = find(target);

  if (found === undefined) {
    return i32(-1);
  }

  return found + i32(1);
}

let last: i32 | undefined = undefined;

function remember(a: i32): i32 {
  let x: i32 | undefined = undefined;

  if (a > i32(0)) {
    x = a;
    last = a;
  }

  if (x !== undefined) {
    return x;
  }

  return i32(0);
}

function lastOr(fallback: i32): i32 {
  if (last === undefined) {
    return fallback;
  }

  return last;
}

function orZero(v: i32 | undefined): i32 {
  if (v === undefined) {
    return i32(0);
  }

  return v;
}

function small(a: u8): i32 {
  return orZero(i32(a)) + orZero(undefined) + orZero(i32(300));
}

function next(v: i64): i64 {
  return v + i64(1);
}

function both(a: i32, b: i64): i64 {
  return next(i64(a)) + next(b);
}

function score(x: i32 | boolean | undefined): i32 {
  if (x === undefined) {
    return i32(0);
  }

  if (typeof x === 'boolean') {
    if (x) {
      return i32(1);
    }

    return i32(2);
  }

  return x + i32(10);
}

function widen(v: i32 | undefined): i32 | boolean | undefined {
  return v;
}

function orNegative(x: i32 | null): i32 {
  if (x === null) {
    return i32(-1);
  }

  return x;
}

function kind(x: i32 | null | undefined): i32 {
  if (x === undefined) {
    return i32(0);
  }

  if (typeof x === 'object') {
    return i32(1);
  }

  return i32(2);
}

function mixed(x: f64): f64 {
  return x + 0.5;
}

const nothing = undefined;

function none(): undefined {
  return nothing;
}

function nullCount(x: null): i32 {
  return i32(1);
}

function wrap(): i32 | undefined {
  const value = none();

  return value;
}

function unwrap(a: i32): i32 {
  let x: i32 | null = null;

  if (a > i32(0)) {
    x = a;
  }

  if (x === null) {
    const y: null = x;

    return nullCount(y);
  }

  return i32(0);
}

let result: i32 = i32(0);

if (use(i32(3)) === i32(7) && use(i32(20)) === i32(-1)) {
  result += i32(1);
}

if (lastOr(i32(9)) === i32(9) && remember(i32(5)) === i32(5) && remember(i32(-1)) === i32(0) && lastOr(i32(9)) === i32(5)) {
  result += i32(2);
}

if (small(u8(7)) === i32(307)) {
  result += i32(4);
}

if (both(i32(1), i64(10)) === i64(13)) {
  result += i32(8);
}

if (score(undefined) === i32(0) && score(true) === i32(1) && score(false) === i32(2) && score(i32(5)) === i32(15) && score(widen(i32(7))) === i32(17) && score(widen(undefined)) === i32(0)) {
  result += i32(16);
}

if (orNegative(null) === i32(-1) && orNegative(i32(4)) === i32(4) && kind(undefined) === i32(0) && kind(null) === i32(1) && kind(i32(7)) === i32(2)) {
  result += i32(32);
}

const smallValue: u8 = u8(2);
const negative: i8 = i8(-3);

if (mixed(f64(smallValue)) === 2.5 && mixed(f64(negative)) === -2.5 && mixed(1.5) === 2) {
  result += i32(64);
}

if (wrap() === undefined && nullCount(null) === i32(1) && unwrap(i32(-1)) === i32(1) && unwrap(i32(1)) === i32(0)) {
  result += i32(128);
}

exit(result);
