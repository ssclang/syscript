declare function exit(code: i32): void;

function orZero(v: i32 | undefined): i32 {
  if (v) {
    return v;
  }

  return i32(0);
}

function fromU8(a: u8): i32 {
  return orZero(i32(a));
}

function returned(a: u8): i32 | undefined {
  return i32(a);
}

let stored: i32 | undefined = undefined;

function store(a: u8): i32 {
  stored = i32(a);

  return orZero(stored);
}

function widen(v: i32 | undefined): i32 | boolean | undefined {
  return v;
}

function truthy(x: i32 | boolean | undefined): i32 {
  if (x) {
    return i32(1);
  }

  return i32(0);
}

let result: i32 = i32(0);

if (fromU8(u8(200)) === i32(200)) {
  result += i32(1);
}

if (orZero(returned(u8(100))) === i32(100)) {
  result += i32(2);
}

if (store(u8(50)) === i32(50)) {
  result += i32(4);
}

if (truthy(widen(i32(7))) === i32(1)) {
  result += i32(8);
}

if (truthy(widen(undefined)) === i32(0)) {
  result += i32(16);
}

exit(result);
