declare function exit(code: i32): void;

function makeCounter(): () => i32 {
  let count: i32 = 0;

  return () => ++count;
}

function apply(f: (x: i32) => i32, value: i32): i32 {
  return f(value);
}

function double(x: i32): i32 {
  return x * 2;
}

function makeAdder(step: i32): (x: i32) => i32 {
  return (x: i32): i32 => x + step;
}

function shared(): i32 {
  let value: i32 = 1;
  const set = (next: i32): void => {
    value = next;
  };

  set(10);

  return value;
}

function nested(): i32 {
  let base: i32 = 1;
  const outer = (): (() => i32) => () => base + 1;

  base = 5;

  return outer()();
}

function loop(): i32 {
  const functions: (() => i32)[] = [];

  for (let i: i32 = 0; i < 3; i++) {
    functions.push(() => i);
  }

  return (functions[0] as () => i32)() + (functions[1] as () => i32)() * 10 + (functions[2] as () => i32)() * 100;
}

let total: i32 = 0;
const addTotal = function (x: i32): void {
  total += x;
};
const a = makeCounter();
const b = makeCounter();
const add5 = makeAdder(5);

console.log(a(), a(), b(), a());
console.log(apply(add5, 10), apply(double, 21), apply((x: i32): i32 => x - 1, 1));
addTotal(3);
addTotal(4);
console.log(total);
console.log(shared(), nested(), loop());
console.log(typeof a, a === a, a === b);
exit(0);
