function variables(a: i32): i32 {
  let b: i32 = a;
  const c: i32 = i32(2);
  let d: i32;
  d = b + c;
  b = i32(10);

  const e: i32 | undefined = i32(3);

  if (e) {
    const c: i32 = i32(100);
    d = d + c;
  }

  return d + b;
}
