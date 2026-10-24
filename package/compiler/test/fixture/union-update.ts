declare function exit(code: i32): void;

function postfix(): i32 {
  let x: i32 | undefined = 1;

  if (x !== undefined) {
    const previous: i32 = x++;

    return previous * 10 + x;
  }

  return 0;
}

function prefix(): i32 {
  let x: i32 | undefined = 1;

  if (x !== undefined) {
    const next: i32 = --x;

    return next * 10 + x;
  }

  return 0;
}

function compound(): i32 {
  let x: i32 | undefined = 4;

  if (x !== undefined) {
    x += 3;
    x *= 2;

    return x;
  }

  return 0;
}

function float(): f64 {
  let x: f64 | undefined = 1.5;

  if (x !== undefined) {
    x++;

    return x;
  }

  return 0;
}

let result: i32 = 0;

if (postfix() === 12) {
  result += 1;
}

if (prefix() === 0) {
  result += 2;
}

if (compound() === 14) {
  result += 4;
}

if (float() === 2.5) {
  result += 8;
}

exit(result);
