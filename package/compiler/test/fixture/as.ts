declare function exit(code: i32): void;

function toInteger(value: i32 | string | undefined): i32 {
  return value as i32;
}

function toText(value: i32 | string | undefined): string {
  return value as string;
}

function toOptionalText(value: i32 | string | undefined): string | undefined {
  return value as string | undefined;
}

function toFlag(value: boolean | null): boolean {
  return value as boolean;
}

function same(value: i32): i32 {
  return value as i32;
}

function widen(value: i32): i32 | string {
  return value as i32 | string;
}

const literal: i32 = 5 as i32;

console.log(toInteger(i32(7)), toText('a'), toOptionalText(undefined), toOptionalText('b'), toFlag(true));
console.log(same(i32(3)), toInteger(widen(i32(4))), literal);
exit(i32(0));
