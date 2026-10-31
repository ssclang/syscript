import BigNumber from 'bignumber.js';

export type SscSignedIntegerType = (typeof sscSignedIntegerTypes)[number];
export const sscSignedIntegerTypes = ['i8', 'i16', 'i32', 'i64'] as const;

export type SscUnsignedIntegerType = (typeof sscUnsignedIntegerTypes)[number];
export const sscUnsignedIntegerTypes = ['u8', 'u16', 'u32', 'u64', 'char'] as const;

export type SscIntegerType = (typeof sscIntegerTypes)[number];
export const sscIntegerTypes = [...sscSignedIntegerTypes, ...sscUnsignedIntegerTypes] as const;

export type SscFloatType = (typeof sscFloatTypes)[number];
export const sscFloatTypes = ['f32', 'f64'] as const;

export type SscNumberType = (typeof sscNumberTypes)[number];
export const sscNumberTypes = [...sscIntegerTypes, ...sscFloatTypes] as const;

export const integerRanges = {
  i8: ['-128', '127'],
  i16: ['-32768', '32767'],
  i32: ['-2147483648', '2147483647'],
  i64: ['-9223372036854775808', '9223372036854775807'],
  u8: ['0', '255'],
  u16: ['0', '65535'],
  u32: ['0', '4294967295'],
  u64: ['0', '18446744073709551615'],
  char: ['0', '4294967295'],
} as const satisfies Record<SscIntegerType, readonly [string, string]>;

export function includes<T extends string>(list: readonly T[], value: string): value is T {
  return list.some((item) => item === value);
}

export function parseSafeNumber(numericString: string, type: SscNumberType) {
  if (includes(sscIntegerTypes, type)) {
    return parseSafeInteger(numericString, type);
  }

  if (includes(sscFloatTypes, type)) {
    return parseSafeFloat(numericString, type);
  }

  throw new Error(type);
}

export function parseSafeCodePoint(value: string | number) {
  if (typeof value === 'string') {
    const codePoint = value.codePointAt(0);

    if (
      codePoint === undefined
      || !value.isWellFormed()
      || String.fromCodePoint(codePoint) !== value
    ) {
      return undefined;
    }

    return codePoint.toString();
  }

  if (
    !Number.isInteger(value)
    || value < 0
    || value > 0x10ffff
    || (value >= 0xd800 && value <= 0xdfff)
  ) {
    return undefined;
  }

  return value.toString();
}

function parseSafeInteger(numericString: string, type: SscIntegerType) {
  const bigNumber = new BigNumber(numericString);
  const [min, max] = integerRanges[type];

  if (!bigNumber.isInteger() || !bigNumber.gte(min) || !bigNumber.lte(max)) {
    return undefined;
  }

  return bigNumber.toFixed();
}

function parseSafeFloat(numericString: string, type: SscFloatType) {
  const bigNumber = new BigNumber(numericString);
  const number = bigNumber.toNumber();
  const narrowed = type === 'f32' ? Math.fround(number) : number;

  if (!bigNumber.eq(narrowed)) {
    return undefined;
  }

  return bigNumber.toFixed();
}

export function isSafeNumber(numericString: string, type: SscNumberType) {
  return parseSafeNumber(numericString, type) !== undefined;
}
