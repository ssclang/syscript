declare function exit(code: i32): void;

function read(): i32 {
  return value;
}

const early: boolean = false;

if (early) {
  exit(read());
}

const value: i32 = i32(7);
exit(read());
