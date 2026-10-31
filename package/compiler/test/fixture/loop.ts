declare function exit(code: i32): void;

function sum(n: i32): i32 {
  let total: i32 = i32(0);

  for (let i: i32 = i32(0); i < n; i++) {
    total += i;
  }

  return total;
}

function countdown(n: i32): i32 {
  let count: i32 = i32(0);

  while (n > i32(0)) {
    count++;
    n--;
  }

  return count;
}

function oddSum(n: i32): i32 {
  let total: i32 = i32(0);

  for (let i: i32 = i32(0); i < i32(100); i++) {
    if (i >= n) {
      break;
    }

    if (i % i32(2) === i32(0)) {
      continue;
    }

    total += i;
  }

  return total;
}

function pair(n: i32): i32 {
  let total: i32 = i32(0);

  for (let i: i32 = i32(0), j: u8 = u8(10); i < n; i++) {
    total += i32(j);
  }

  return total;
}

function block(): i32 {
  let v: i32 = i32(1);

  {
    const w: i32 = i32(2);
    v += w;
  }

  return v;
}

let top: i32 = i32(0);

for (let k: i32 = i32(0); k < i32(3); k++) {
  top += k;
}

exit(sum(i32(5)) + countdown(i32(4)) + oddSum(i32(10)) + pair(i32(3)) + block() + top);
