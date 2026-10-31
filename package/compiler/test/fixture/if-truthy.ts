declare function exit(code: i32): void;
declare function acos(x: f64): f64;

function check(a: boolean, b: i32, c: f64): i32 {
  if (a) {
    return i32(1);
  }

  if (b) {
    return i32(2);
  }

  if (c) {
    return i32(3);
  }

  return i32(7);
}

exit(check(false, i32(0), acos(2)));
