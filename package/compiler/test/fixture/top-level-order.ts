declare function exit(code: i32): void;

let log: i32 = i32(0);

function push(n: i32): i32 {
  log = log * i32(10) + n;

  return n;
}

const a: i32 = push(i32(1));
const b: i32 = push(i32(2)) + a;
push(i32(3));
exit(log + b * i32(0));
