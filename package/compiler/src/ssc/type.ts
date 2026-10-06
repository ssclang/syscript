import BigNumber from 'bignumber.js';

export type SscIntegerType = (typeof sscIntegerTypes)[number];
export const sscIntegerTypes = ['i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64'] as const;

export type SscFloatType = (typeof sscFloatTypes)[number];
export const sscFloatTypes = ['f32', 'f64'] as const;

export type SscOtherType = (typeof sscOtherTypes)[number];
export const sscOtherTypes = ['boolean', 'void'] as const;

export type SscNumberType = (typeof sscNumberTypes)[number];
export const sscNumberTypes = [...sscIntegerTypes, ...sscFloatTypes] as const;

// TODO: string
export type SscAllType = (typeof sscAllTypes)[number];
export const sscAllTypes = [...sscNumberTypes, ...sscOtherTypes] as const;

const integerRanges = {
  i8: ['-128', '127'],
  i16: ['-32768', '32767'],
  i32: ['-2147483648', '2147483647'],
  i64: ['-9223372036854775808', '9223372036854775807'],
  u8: ['0', '255'],
  u16: ['0', '65535'],
  u32: ['0', '4294967295'],
  u64: ['0', '18446744073709551615'],
} as const satisfies Record<SscIntegerType, readonly [string, string]>;

/**
 * 값이 잘리지 않고 올라갈 수 있는 방향. 이 표에 없으면 암묵 변환을 막는다.
 * `i32 -> f32`는 가수부가 24비트라, `i64 -> f64`는 53비트라 빠졌다.
 */
const widenings = {
  i8: ['i16', 'i32', 'i64', 'f32', 'f64'],
  i16: ['i32', 'i64', 'f32', 'f64'],
  i32: ['i64', 'f64'],
  i64: [],
  u8: ['u16', 'u32', 'u64', 'i16', 'i32', 'i64', 'f32', 'f64'],
  u16: ['u32', 'u64', 'i32', 'i64', 'f32', 'f64'],
  u32: ['u64', 'i64', 'f64'],
  u64: [],
  f32: ['f64'],
  f64: [],
  boolean: ['i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64', 'f32', 'f64'], // 0 or 1
  void: [],
} as const satisfies Record<SscAllType, readonly SscAllType[]>;

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

export function isSafeNumber(numericString: string, type: SscNumberType) {
  return parseSafeNumber(numericString, type) !== undefined;
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

/**
 * `from`에서 `to`로 옮겨도 값이 잘리지 않는지. 값을 모르는 자리에서 타입만으로 판단한다.
 * 변수나 호출 결과가 여기 해당한다. 리터럴은 값을 아니까 `parseSafeNumber`를 쓴다.
 */
export function canWiden(from: SscAllType, to: SscAllType) {
  return from === to || includes(widenings[from], to);
}
