import BigNumber from 'bignumber.js';
import {
  includes,
  integerRanges,
  sscFloatTypes,
  SscNumberType,
  sscSignedIntegerTypes,
  sscUnsignedIntegerTypes,
} from '~/ssc/type.js';

/*
 * 패치한 TypeScript checker(ssc.go)의 공통 타입 규칙을 그대로 옮긴다. checker를 통과한
 * 프로그램만 내려오지만, 규칙이 어긋나면 잘못된 C가 나오므로 여기서도 판정하고 에러를 낸다.
 */

const losslessTargets = {
  i8: ['i8', 'i16', 'i32', 'i64', 'f32', 'f64'],
  i16: ['i16', 'i32', 'i64', 'f32', 'f64'],
  i32: ['i32', 'i64', 'f64'],
  i64: ['i64'],
  u8: ['u8', 'u16', 'u32', 'u64', 'i16', 'i32', 'i64', 'f32', 'f64'],
  u16: ['u16', 'u32', 'u64', 'i32', 'i64', 'f32', 'f64'],
  u32: ['u32', 'u64', 'i64', 'f64'],
  u64: ['u64'],
  char: ['char', 'u32', 'u64', 'i64', 'f64'],
  f32: ['f32', 'f64'],
  f64: ['f64'],
} as const satisfies Record<SscNumberType, readonly SscNumberType[]>;

export type CommonTypeOperand = { type: SscNumberType } | { literal: BigNumber };

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

/**
 * 피연산자를 모두 손실 없이 담는 가장 작은 타입. 리터럴은 음수가 아니면 ssc 타입의 부호를
 * 따르고, 소수가 있으면 실수만 남는다. 리터럴뿐이면 f64다.
 */
export function commonType(operands: readonly CommonTypeOperand[]): SscNumberType {
  const types = operands.flatMap((o) => ('type' in o ? [o.type] : []));
  const literals = operands.flatMap((o) => ('literal' in o ? [o.literal] : []));

  if (!types.length) {
    return 'f64';
  }

  const isFloat =
    types.some((t) => includes(sscFloatTypes, t)) || literals.some((l) => !literalInteger(l));
  const isSigned =
    types.some((t) => includes(sscSignedIntegerTypes, t))
    || literals.some((l) => {
      const integer = literalInteger(l);
      return !!integer && integer.isNegative() && !integer.isZero();
    });
  let candidates: readonly SscNumberType[];

  if (isFloat) {
    candidates = sscFloatTypes;
  } else if (isSigned) {
    candidates = [...sscSignedIntegerTypes, ...sscFloatTypes];
  } else {
    candidates = [...sscUnsignedIntegerTypes, ...sscFloatTypes];
  }

  const common = candidates.find(
    (name) =>
      types.every((t) => isLossless(t, name)) && literals.every((l) => isLiteralInRange(l, name)),
  );

  if (!common) {
    throw new Error(`no common type: ${operands.map(operandText).join(', ')}`);
  }

  return common;
}

function operandText(operand: CommonTypeOperand) {
  return 'type' in operand ? operand.type : operand.literal.toFixed();
}
