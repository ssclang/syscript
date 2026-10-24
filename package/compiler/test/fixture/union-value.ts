declare function exit(code: i32): void;

function orZero(v: i32 | undefined): i32 {
  if (v) {
    return v;
  }

  return 0;
}

function fromU8(a: u8): i32 {
  return orZero(a);
}

function returned(a: u8): i32 | undefined {
  return a;
}

let stored: i32 | undefined = undefined;

function store(a: u8): i32 {
  stored = a;

  return orZero(stored);
}

function widen(v: i32 | undefined): i32 | boolean | undefined {
  return v;
}

function truthy(x: i32 | boolean | undefined): i32 {
  if (x) {
    return 1;
  }

  return 0;
}

let result: i32 = 0;

if (fromU8(200) === 200) {
  result += 1;
}

if (orZero(returned(100)) === 100) {
  result += 2;
}

if (store(50) === 50) {
  result += 4;
}

if (truthy(widen(7)) === 1) {
  result += 8;
}

if (truthy(widen(undefined)) === 0) {
  result += 16;
}

exit(result);
