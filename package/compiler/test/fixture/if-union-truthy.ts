declare function exit(code: i32): void;
declare function acos(x: f64): f64;

function truthy(a: i32 | undefined, b: number | null, c: boolean | undefined): i32 {
  if (a) {
    return i32(1);
  }

  if (b) {
    return i32(2);
  }

  if (c) {
    return i32(4);
  }

  return i32(0);
}

function i32Value(x: i32): i32 {
  return x;
}

function numberValue(x: number): number {
  return x;
}

exit(
  truthy(undefined, null, undefined)
    + truthy(i32Value(i32(0)), number(acos(f64(2))), false)
    + truthy(i32Value(i32(5)), null, undefined)
    + truthy(undefined, numberValue(0.5), undefined)
    + truthy(undefined, null, true)
    + truthy(i32(0), 0, false)
    + truthy(i32(3), null, undefined)
    + truthy(undefined, 2.5, undefined),
);
