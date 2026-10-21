declare function exit(code: i32): void;

const five = 5;

function parenthesized(a: i32): i32 {
  return a + (5);
}

function constant(a: i32): i32 {
  return a + five;
}

function assignment(a: i32): i32 {
  let b: i32 = 0;
  const c: i32 = a + (b = 5);

  return c + b;
}

function exact(a: u64): u64 {
  return a - 9007199254740993;
}

let result: i32 = parenthesized(1) + constant(1) + assignment(1);

if (exact(9007199254740995) === 2) {
  result = result + 100;
}

exit(result);
