declare function exit(code: i32): void;

function early(): i32 {
  return value;
}

function late(): i32 {
  return value;
}

const run: boolean = false;

if (run) {
  exit(early());
}

const value: i32 = 7;
exit(late());
