declare function exit(code: i32): void;

function postfix(): i32 {
  let x: i32 | undefined = i32(1);

  if (x !== undefined) {
    const previous: i32 = x++;

    return previous * i32(10) + x;
  }

  return i32(0);
}

function prefix(): i32 {
  let x: i32 | undefined = i32(1);

  if (x !== undefined) {
    const next: i32 = --x;

    return next * i32(10) + x;
  }

  return i32(0);
}

function compound(): i32 {
  let x: i32 | undefined = i32(4);

  if (x !== undefined) {
    x += i32(3);
    x *= i32(2);

    return x;
  }

  return i32(0);
}

function float(): f64 {
  let x: f64 | undefined = 1.5;

  if (x !== undefined) {
    x++;

    return x;
  }

  return 0;
}

let result: i32 = i32(0);

if (postfix() === i32(12)) {
  result += i32(1);
}

if (prefix() === i32(0)) {
  result += i32(2);
}

if (compound() === i32(14)) {
  result += i32(4);
}

if (float() === 2.5) {
  result += i32(8);
}

exit(result);
