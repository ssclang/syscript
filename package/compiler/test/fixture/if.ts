function truthy(a: boolean, b: i32, c: u8, d: f64, e: f32): i32 {
  if (a) {
    return i32(1);
  } else if (b) {
    return i32(2);
  } else if (c) {
    return i32(3);
  } else if (d) {
    return i32(4);
  } else if (e) {
    return i32(5);
  } else {
    return i32(0);
  }
}

function literal(): i32 {
  if (false) {
    return i32(1);
  }

  return i32(0);
}

function parenthesized(b: i32): i32 {
  return b + (b + b);
}

function character(a: char): i32 {
  if (a) {
    return i32(1);
  }

  return i32(0);
}
