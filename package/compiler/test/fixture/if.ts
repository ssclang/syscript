function truthy(a: boolean, b: i32, c: u8, d: f64, e: f32): i32 {
  if (a) {
    return 1;
  } else if (b) {
    return 2;
  } else if (c) {
    return 3;
  } else if (d) {
    return 4;
  } else if (e) {
    return 5;
  } else {
    return 0;
  }
}

function literal(): i32 {
  if (false) {
    return 1;
  }

  return 0;
}

function parenthesized(b: i32): i32 {
  return b + (b + b);
}

function character(a: char): i32 {
  if (a) {
    return 1;
  }

  return 0;
}
