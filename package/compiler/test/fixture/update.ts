declare function exit(code: i32): void;

function postfix(a: i32): i32 {
  let v: i32 = a;
  const previous: i32 = v++;

  return previous * i32(10) + v;
}

function prefix(a: i32): i32 {
  let v: i32 = a;
  const next: i32 = ++v;

  return next * i32(10) + v;
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
  v += i32(10);
  v -= i32(2);
  v *= i32(3);
  v /= i32(2);
  v %= i32(7);
  v <<= i32(2);
  v >>= i32(1);
  v |= i32(1);
  v &= i32(7);
  v ^= i32(2);

  return v;
}

function compoundFloat(a: f64): f64 {
  let v: f64 = a;
  v += 0.5;
  v %= 2;

  return v;
}

let result: i32 = i32(0);

if (postfix(i32(3)) === i32(34)) {
  result += i32(1);
}

if (prefix(i32(3)) === i32(44)) {
  result += i32(2);
}

if (decrement(u8(5)) === u8(3)) {
  result += i32(4);
}

if (float(1.5) === 2.5) {
  result += i32(8);
}

if (compound(i32(4)) === i32(3)) {
  result += i32(16);
}

if (compoundFloat(3) === 1.5) {
  result += i32(32);
}

exit(result);
