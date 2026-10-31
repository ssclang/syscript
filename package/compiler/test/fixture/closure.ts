declare function exit(code: i32): void;

function makeCounter(): () => i32 {
  let count: i32 = i32(0);

  return () => ++count;
}

function apply(f: (x: i32) => i32, value: i32): i32 {
  return f(value);
}

function double(x: i32): i32 {
  return x * i32(2);
}

function makeAdder(step: i32): (x: i32) => i32 {
  return (x: i32): i32 => x + step;
}

function shared(): i32 {
  let value: i32 = i32(1);
  const set = (next: i32): void => {
    value = next;
  };

  set(i32(10));

  return value;
}

function nested(): i32 {
  let base: i32 = i32(1);
  const outer = (): (() => i32) => () => base + i32(1);

  base = i32(5);

  return outer()();
}

function loop(): i32 {
  const functions: (() => i32)[] = [];

  for (let i: i32 = i32(0); i < i32(3); i++) {
    functions.push(() => i);
  }

  return (functions[u64(0)] as () => i32)() + (functions[u64(1)] as () => i32)() * i32(10) + (functions[u64(2)] as () => i32)() * i32(100);
}

let total: i32 = i32(0);
const addTotal = function (x: i32): void {
  total += x;
};
const a = makeCounter();
const b = makeCounter();
const add5 = makeAdder(i32(5));

console.log(a(), a(), b(), a());
console.log(apply(add5, i32(10)), apply(double, i32(21)), apply((x: i32): i32 => x - i32(1), i32(1)));
addTotal(i32(3));
addTotal(i32(4));
console.log(total);
console.log(shared(), nested(), loop());
console.log(typeof a, a === a, a === b);
exit(i32(0));
