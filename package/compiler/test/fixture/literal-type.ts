declare function exit(code: i32): void;

const five = i32(5);

function parenthesized(a: i32): i32 {
  return a + (i32(5));
}

function constant(a: i32): i32 {
  return a + five;
}

function assignment(a: i32): i32 {
  let b: i32 = i32(0);
  const c: i32 = a + (b = i32(5));

  return c + b;
}

function exact(a: u64): u64 {
  return a - u64('9007199254740993');
}

let result: i32 = parenthesized(i32(1)) + constant(i32(1)) + assignment(i32(1));

if (exact(u64('9007199254740995')) === u64(2)) {
  result = result + i32(100);
}

exit(result);
