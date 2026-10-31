function truthy(a: i32 | undefined, b: f64 | null, c: boolean | undefined): i32 {
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

function pass(a: i32): i32 {
  return truthy(a, null, undefined);
}

function sized(a: u8 | i32): i32 {
  if (a) {
    return i32(1);
  }

  return i32(0);
}

function literal(): i32 {
  return truthy(i32(3), 2.5, undefined) + sized(i32(3)) + sized(i32(300));
}
