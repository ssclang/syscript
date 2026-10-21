declare function exit(code: i32): void;

function postfix(a: i32): i32 {
  let v: i32 = a;
  const previous: i32 = v++;

  return previous * 10 + v;
}

function prefix(a: i32): i32 {
  let v: i32 = a;
  const next: i32 = ++v;

  return next * 10 + v;
}

function decrement(a: u8): u8 {
  let v: u8 = a;
  v--;
  --v;

  return v;
}

function float(a: f64): f64 {
  let v: f64 = a;
  v++;

  return v;
}

function compound(a: i32): i32 {
  let v: i32 = a;
  v += 10;
  v -= 2;
  v *= 3;
  v /= 2;
  v %= 7;
  v <<= 2;
  v >>= 1;
  v |= 1;
  v &= 7;
  v ^= 2;

  return v;
}

function compoundFloat(a: f64): f64 {
  let v: f64 = a;
  v += 0.5;
  v %= 2;

  return v;
}

let result: i32 = 0;

if (postfix(3) === 34) {
  result += 1;
}

if (prefix(3) === 44) {
  result += 2;
}

if (decrement(5) === 3) {
  result += 4;
}

if (float(1.5) === 2.5) {
  result += 8;
}

if (compound(4) === 3) {
  result += 16;
}

if (compoundFloat(3) === 1.5) {
  result += 32;
}

exit(result);
