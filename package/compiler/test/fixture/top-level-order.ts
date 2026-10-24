declare function exit(code: i32): void;

let log: i32 = 0;

function push(n: i32): i32 {
  log = log * 10 + n;

  return n;
}

const a: i32 = push(1);
const b: i32 = push(2) + a;
push(3);
exit(log + b * 0);
