declare function exit(code: i32): void;

function sum(n: i32): i32 {
  let total: i32 = 0;

  for (let i: i32 = 0; i < n; i++) {
    total += i;
  }

  return total;
}

function countdown(n: i32): i32 {
  let count: i32 = 0;

  while (n > 0) {
    count++;
    n--;
  }

  return count;
}

function oddSum(n: i32): i32 {
  let total: i32 = 0;

  for (let i: i32 = 0; i < 100; i++) {
    if (i >= n) {
      break;
    }

    if (i % 2 === 0) {
      continue;
    }

    total += i;
  }

  return total;
}

function pair(n: i32): i32 {
  let total: i32 = 0;

  for (let i: i32 = 0, j: u8 = 10; i < n; i++) {
    total += j;
  }

  return total;
}

function block(): i32 {
  let v: i32 = 1;

  {
    const w: i32 = 2;
    v += w;
  }

  return v;
}

let top: i32 = 0;

for (let k: i32 = 0; k < 3; k++) {
  top += k;
}

exit(sum(5) + countdown(4) + oddSum(10) + pair(3) + block() + top);
