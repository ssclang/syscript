declare function exit(code: i32): void;

function u8s(a: u8): boolean {
  return addWrap(a, u8(100)) === u8(44) && subWrap(a, u8(201)) === u8(255) && mulWrap(a, u8(2)) === u8(144);
}

function i32s(a: i32): boolean {
  return addWrap(a, i32(1)) === i32(-2147483648) && mulWrap(a, i32(2)) === i32(-2);
}

function u16s(a: u16): boolean {
  return mulWrap(a, a) === u16(1);
}

let result: i32 = i32(0);

if (u8s(u8(200))) {
  result += i32(1);
}

if (i32s(i32(2147483647))) {
  result += i32(2);
}

if (u16s(u16(65535))) {
  result += i32(4);
}

exit(result);
