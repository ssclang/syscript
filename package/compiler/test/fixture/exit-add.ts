declare function exit(code: i32): void;

function add(a: i32, b: i32): i32 {
  return a + b;
}

exit(add(3, 4));
