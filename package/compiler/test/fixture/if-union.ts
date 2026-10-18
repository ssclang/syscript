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

function pass(a: i32): i32 {
  return truthy(a, null, undefined);
}

function sized(a: u8 | i32): i32 {
  if (a) {
    return 1;
  }

  return 0;
}

function literal(): i32 {
  return truthy(3, 2.5, undefined) + sized(3) + sized(300);
}
