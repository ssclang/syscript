declare function exit(code: i32): void;

function pick(c: boolean, a: i32, b: i64): i64 {
  return c ? a : b;
}

function choose(c: boolean, a: i32): i32 | string {
  return c ? a : 'none';
}

function orZero(u: i32 | undefined): i32 {
  return u ?? 0;
}

function orText(u: i32 | undefined): i32 | string {
  return u ?? 'none';
}

function orDefault(u: string | null): string {
  return u ?? 'default';
}

const flag: boolean = true;

console.log(pick(true, 1, 2), pick(false, 1, 2), choose(true, 3), choose(false, 3));
console.log(orZero(5), orZero(undefined), orText(6), orText(undefined), orDefault(null), orDefault('x'));
console.log(flag ? 'yes' : 'no', !flag ? 1 : 2);
exit(0);
