import BigNumber from 'bignumber.js';
import { includes, integerRanges, sscFloatTypes, SscNumberType } from '~/ssc/type.js';

/*
 * 숫자 변환 규칙. 생성자가 손실 없이 바꿀 수 있는지와 리터럴이 타입 범위에 드는지를 판정한다.
 */

const losslessTargets = {
  i8: ['i8', 'i16', 'i32', 'i64', 'f32', 'f64', 'number'],
  i16: ['i16', 'i32', 'i64', 'f32', 'f64', 'number'],
  i32: ['i32', 'i64', 'f64', 'number'],
  i64: ['i64'],
  u8: ['u8', 'u16', 'u32', 'u64', 'i16', 'i32', 'i64', 'f32', 'f64', 'number'],
  u16: ['u16', 'u32', 'u64', 'i32', 'i64', 'f32', 'f64', 'number'],
  u32: ['u32', 'u64', 'i64', 'f64', 'number'],
  u64: ['u64'],
  char: ['char', 'u32', 'u64', 'i64', 'f64', 'number'],
  f32: ['f32', 'f64', 'number'],
  f64: ['f64', 'number'],
  number: ['number', 'f64'],
} as const satisfies Record<SscNumberType, readonly SscNumberType[]>;

/** 10진 문자열을 IEEE 754 f64로 반올림한다. 셀프 호스팅에서는 C의 `strtod`로 바꾼다. */
export function toFloat64(text: string) {
  return Number(text);
}

/** 원본 텍스트 그대로의 값. 구분자, 진법, 지수는 BigNumber가 읽는다. */
export function parseNumericLiteral(text: string, negative: boolean) {
  const value = new BigNumber(text);

  return negative ? value.negated() : value;
}

/**
 * 정수 자리에 들어갈 값. 원본 값이 정수면 그대로, 아니면 f64로 읽은 값이 정수일 때 그 값이다
 * (`1e-1000`은 언더플로로 0). 둘 다 아니면 없다.
 */
export function literalInteger(literal: BigNumber) {
  if (literal.isInteger()) {
    return literal;
  }

  const number = toFloat64(literal.toString());

  // f64는 2진수라 `toString(2)`는 정확한 값을 쓴다. 10진 `String()`은 2^63을 9223372036854776000으로 쓴다.
  return Number.isInteger(number) ? new BigNumber(number.toString(2), 2) : undefined;
}

/** 실수는 IEEE 754로 반올림하므로 정수 타입만 리터럴을 제한한다. */
export function isLiteralInRange(literal: BigNumber, type: SscNumberType) {
  if (includes(sscFloatTypes, type)) {
    return true;
  }

  const [min, max] = integerRanges[type];
  const integer = literalInteger(literal);

  return !!integer && integer.gte(min) && integer.lte(max);
}

export function isLossless(from: SscNumberType, to: SscNumberType) {
  return includes(losslessTargets[from], to);
}
