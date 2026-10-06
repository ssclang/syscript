import { assert } from '@syscript/share/util';
import BigNumber from 'bignumber.js';
import { cast } from '~/c/c-builder.js';
import { toCTypeName } from '~/c/c.js';
import { includes, sscFloatTypes, SscIntegerType, SscNumberType } from '~/ssc/type.js';

/*
 * 패치한 TypeScript checker(ssc.go)의 공통 타입 규칙을 그대로 옮긴다. checker를 통과한
 * 프로그램만 내려오지만, 규칙이 어긋나면 잘못된 C가 나오므로 여기서도 판정하고 에러를 낸다.
 */

const signedTypes = ['i8', 'i16', 'i32', 'i64'] as const satisfies readonly SscIntegerType[];

const unsignedTypes = ['u8', 'u16', 'u32', 'u64'] as const satisfies readonly SscIntegerType[];

const losslessTargets = {
  i8: ['i8', 'i16', 'i32', 'i64', 'f32', 'f64'],
  i16: ['i16', 'i32', 'i64', 'f32', 'f64'],
  i32: ['i32', 'i64', 'f64'],
  i64: ['i64'],
  u8: ['u8', 'u16', 'u32', 'u64', 'i16', 'i32', 'i64', 'f32', 'f64'],
  u16: ['u16', 'u32', 'u64', 'i32', 'i64', 'f32', 'f64'],
  u32: ['u32', 'u64', 'i64', 'f64'],
  u64: ['u64'],
  f32: ['f32', 'f64'],
  f64: ['f64'],
} as const satisfies Record<SscNumberType, readonly SscNumberType[]>;

const integerRanges = {
  i8: { min: new BigNumber('-128'), max: new BigNumber('127') },
  i16: { min: new BigNumber('-32768'), max: new BigNumber('32767') },
  i32: { min: new BigNumber('-2147483648'), max: new BigNumber('2147483647') },
  i64: { min: new BigNumber('-9223372036854775808'), max: new BigNumber('9223372036854775807') },
  u8: { min: new BigNumber('0'), max: new BigNumber('255') },
  u16: { min: new BigNumber('0'), max: new BigNumber('65535') },
  u32: { min: new BigNumber('0'), max: new BigNumber('4294967295') },
  u64: { min: new BigNumber('0'), max: new BigNumber('18446744073709551615') },
} as const satisfies Record<SscIntegerType, { min: BigNumber; max: BigNumber }>;

export type CommonTypeOperand = { type: SscNumberType } | { literal: BigNumber };

/** 10진 문자열을 IEEE 754 f64로 반올림한다. 셀프 호스팅에서는 C의 `strtod`로 바꾼다. */
export function toFloat64(text: string) {
  return Number(text);
}

/** 원본 텍스트 그대로의 값. 구분자만 지우고 진법과 지수는 BigNumber가 읽는다. */
export function parseNumericLiteral(text: string, negative: boolean) {
  const value = new BigNumber(text.replaceAll('_', ''));

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

  const range = integerRanges[type];
  const integer = literalInteger(literal);

  return !!integer && range.min.lte(integer) && integer.lte(range.max);
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
    types.some((t) => includes(signedTypes, t))
    || literals.some((l) => {
      const integer = literalInteger(l);
      return !!integer && integer.isNegative() && !integer.isZero();
    });
  let candidates: readonly SscNumberType[];

  if (isFloat) {
    candidates = sscFloatTypes;
  } else if (isSigned) {
    candidates = [...signedTypes, ...sscFloatTypes];
  } else {
    candidates = [...unsignedTypes, ...sscFloatTypes];
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

/**
 * 리터럴을 그 자리의 C 타입으로 쓴다. 정수는 정확한 값에 `wb`/`uwb`를 붙여 캐스트하고, 실수는
 * 원본 값에 소수점을 보장해 C가 반올림하게 한다. 범위를 넘는 실수는 C의 범위 경고 없이 같은
 * 결과(무한대, 0)가 되도록 직접 쓴다.
 */
export function cNumericLiteral(literal: BigNumber, type: SscNumberType) {
  if (!isLiteralInRange(literal, type)) {
    throw new Error(`'${literal.toFixed()}' is out of the range of ${type}`);
  }

  if (!includes(sscFloatTypes, type)) {
    const integer = literalInteger(literal);

    assert(integer, `not an integer: ${literal.toFixed()}`);

    const suffix = integer.isNegative() && !integer.isZero() ? 'wb' : 'uwb';

    return cast(toCTypeName(type), `${integer.toFixed()}${suffix}`);
  }

  const suffix = type === 'f32' ? 'f' : '';
  const number = toFloat64(literal.toString());
  const narrowed = type === 'f32' ? Math.fround(number) : number;
  const sign = literal.isNegative() ? '-' : '';

  if (!Number.isFinite(narrowed)) {
    return withSign(`${sign}__builtin_inf${suffix}()`);
  }

  if (narrowed === 0) {
    return withSign(`${sign}0.0${suffix}`);
  }

  const text = literal.toString();

  return withSign(`${/[.e]/.test(text) ? text : `${text}.0`}${suffix}`);
}

/** 음수는 `(-1.5)`처럼 감싸 앞의 연산자와 붙어 `--`가 되지 않게 한다. */
function withSign(text: string) {
  return text.startsWith('-') ? `(${text})` : text;
}
