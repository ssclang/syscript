declare function exit(code: i32): void;

function integer(a: i32, b: u8): i32 {
  return ((a * 3 - b) / 2) % 100;
}

function float(a: f64, b: f32): f64 {
  return ((a * 3 - b) / 2) % 100;
}

float(1, 2);
exit(integer(20, 4));
