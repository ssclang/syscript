declare function exit(code: i32): void;
declare function acos(x: f64): f64;

function check(a: boolean, b: i32, c: f64): i32 {
  if (a) {
    return 1;
  }

  if (b) {
    return 2;
  }

  if (c) {
    return 3;
  }

  return 7;
}

exit(check(false, 0, acos(2)));
