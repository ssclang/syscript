declare function exit(code: i32): void;

function integer(a: i32, b: u8): i32 {
  return ((a * i32(3) - i32(b)) / i32(2)) % i32(100);
}

function float(a: number, b: f32): number {
  return ((a * 3 - number(b)) / 2) % 100;
}

float(1, f32(2));
exit(integer(i32(20), u8(4)));
