declare function exit(code: i32): void;
declare function acos(x: f64): f64;

function truthy(a: i32 | undefined, b: f64 | null, c: boolean | undefined): i32 {
  if (a) {
    return 1;
  }

  if (b) {
    return 2;
  }

  if (c) {
    return 4;
  }

  return 0;
}

function i32Value(x: i32): i32 {
  return x;
}

function f64Value(x: f64): f64 {
  return x;
}

exit(
  truthy(undefined, null, undefined)
    + truthy(i32Value(0), acos(2), false)
    + truthy(i32Value(5), null, undefined)
    + truthy(undefined, f64Value(0.5), undefined)
    + truthy(undefined, null, true)
    + truthy(0, 0, false)
    + truthy(3, null, undefined)
    + truthy(undefined, 2.5, undefined),
);
