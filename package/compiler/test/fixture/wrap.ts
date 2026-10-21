declare function exit(code: i32): void;

function u8s(a: u8): boolean {
  return addWrap(a, 100) === 44 && subWrap(a, 201) === 255 && mulWrap(a, 2) === 144;
}

function i32s(a: i32): boolean {
  return addWrap(a, 1) === -2147483648 && mulWrap(a, 2) === -2;
}

function u16s(a: u16): boolean {
  return mulWrap(a, a) === 1;
}

let result: i32 = 0;

if (u8s(200)) {
  result += 1;
}

if (i32s(2147483647)) {
  result += 2;
}

if (u16s(65535)) {
  result += 4;
}

exit(result);
