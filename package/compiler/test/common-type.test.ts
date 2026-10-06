import { describe, expect, test } from 'vitest';
import {
  cNumericLiteral,
  commonType,
  literalInteger,
  parseNumericLiteral,
  toFloat64,
} from '~/ts/common-type.js';

describe('parseNumericLiteral keeps the source value', () => {
  test.each([
    ['0', '0'],
    ['1.5', '1.5'],
    ['1e3', '1000'],
    ['1e-1000', '1e-1000'],
    ['1e1000', '1e+1000'],
    ['1.0000000000000000001', '1.0000000000000000001'],
    ['9223372036854775807', '9223372036854775807'],
    ['18446744073709551617', '18446744073709551617'],
    ['0xffff_ffff_ffff_ffff', '18446744073709551615'],
    ['0b1_0000_0000', '256'],
    ['0o377', '255'],
    ['1_000.000_1', '1000.0001'],
  ])('%s', (text, expected) => {
    expect(parseNumericLiteral(text, false).toString()).toBe(expected);
    expect(parseNumericLiteral(text, true).toString()).toBe(
      expected === '0' ? '0' : `-${expected}`,
    );
  });
});

describe('toFloat64 matches JavaScript', () => {
  const texts = [
    '0.1',
    '1e20',
    '1e21',
    '1e22',
    '1e23',
    '1e308',
    '1e309',
    '1e-323',
    '1e-324',
    '5e-324',
    '2.4703282292062327e-324',
    '2.4703282292062328e-324',
    '2.2250738585072011e-308',
    '1.7976931348623157e308',
    '1.7976931348623158e308',
    '1.7976931348623159e308',
    '9007199254740993',
    '9.223372036854775807e18',
    '18446744073709551617',
    '0.30000000000000004',
    '123456789.123456789123456789',
  ];

  test.each(texts)('%s', (text) => {
    for (const negative of [false, true]) {
      const value = parseNumericLiteral(text, negative);

      expect(Object.is(toFloat64(value.toString()), Number(`${negative ? '-' : ''}${text}`))).toBe(
        true,
      );
    }
  });

  test('random decimals', () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let i = 0; i < 5000; i++) {
      const digits = Array.from({ length: 1 + Math.floor(random() * 25) }, () =>
        Math.floor(random() * 10),
      ).join('');
      const point = Math.floor(random() * digits.length);
      const exponent = Math.floor(random() * 700) - 350;
      const text = `${digits.slice(0, point) || '0'}.${digits.slice(point) || '0'}e${exponent}`;

      expect(
        Object.is(toFloat64(parseNumericLiteral(text, false).toString()), Number(text)),
        text,
      ).toBe(true);
    }
  });
});

describe('commonType', () => {
  const literal = (text: string, negative = false) => ({
    literal: parseNumericLiteral(text, negative),
  });

  test.each([
    [[{ type: 'u8' as const }, literal('300')], 'u16'],
    [[{ type: 'u8' as const }, literal('1', true)], 'i16'],
    [[{ type: 'u8' as const }, literal('0', true)], 'u8'],
    [[{ type: 'u8' as const }, literal('1.5')], 'f32'],
    [[{ type: 'i32' as const }, literal('1.5')], 'f64'],
    [[{ type: 'i32' as const }, literal('1e-1000')], 'i32'],
    [[{ type: 'u8' as const }, literal('1.0000000000000000001')], 'u8'],
    [[{ type: 'u32' as const }, literal('5000000000')], 'u64'],
    [[{ type: 'i64' as const }, literal('9223372036854775807')], 'i64'],
    [[literal('1'), literal('2')], 'f64'],
  ])('%j', (operands, expected) => {
    expect(commonType(operands)).toBe(expected);
  });

  test('no common type', () => {
    expect(() => commonType([{ type: 'u64' }, literal('1.5')])).toThrow('no common type');
    expect(() => commonType([{ type: 'i64' }, literal('9223372036854775808')])).toThrow(
      'no common type',
    );
  });
});

describe('cNumericLiteral', () => {
  test.each([
    ['1000', 'i32', '(ssc__type__i32)1000uwb'],
    ['1e3', 'i32', '(ssc__type__i32)1000uwb'],
    ['2.55e2', 'u8', '(ssc__type__u8)255uwb'],
    ['1e-1000', 'i32', '(ssc__type__i32)0uwb'],
    ['1.0000000000000000001', 'i32', '(ssc__type__i32)1uwb'],
    ['1.844674407370955e19', 'u64', '(ssc__type__u64)18446744073709550000uwb'],
    ['18446744073709551615', 'u64', '(ssc__type__u64)18446744073709551615uwb'],
    ['1', 'f64', '1.0'],
    ['0.1', 'f64', '0.1'],
    ['1e20', 'f64', '100000000000000000000.0'],
    ['1e21', 'f64', '1e+21'],
    ['1e1000', 'f64', '__builtin_inf()'],
    ['1e-1000', 'f64', '0.0'],
    ['0.1', 'f32', '0.1f'],
    ['1e39', 'f32', '__builtin_inff()'],
    ['1e-50', 'f32', '0.0f'],
  ] as const)('%s as %s', (text, type, expected) => {
    expect(cNumericLiteral(parseNumericLiteral(text, false), type)).toBe(expected);
  });

  test('negative values are wrapped', () => {
    expect(cNumericLiteral(parseNumericLiteral('1.5', true), 'f32')).toBe('(-1.5f)');
    expect(cNumericLiteral(parseNumericLiteral('1e1000', true), 'f64')).toBe('(-__builtin_inf())');
  });

  test('a f64 literal reads back as the same value', () => {
    for (const text of [
      '0.1',
      '1e300',
      '5e-324',
      '1.7976931348623157e308',
      '123456789.123456789',
    ]) {
      const value = parseNumericLiteral(text, false);

      expect(Number(cNumericLiteral(value, 'f64'))).toBe(Number(text));
    }
  });

  test('out of an integer range', () => {
    expect(() => cNumericLiteral(parseNumericLiteral('300', false), 'u8')).toThrow(
      'out of the range of u8',
    );
    expect(() => cNumericLiteral(parseNumericLiteral('1.5', false), 'i32')).toThrow(
      'out of the range of i32',
    );
    expect(() => cNumericLiteral(parseNumericLiteral('1e-3', false), 'i32')).toThrow(
      'out of the range of i32',
    );
    expect(() => cNumericLiteral(parseNumericLiteral('1e1000', false), 'u64')).toThrow(
      'out of the range of u64',
    );
  });

  test('negative integers use a signed literal', () => {
    expect(cNumericLiteral(parseNumericLiteral('1', true), 'i32')).toBe('(ssc__type__i32)-1wb');
    expect(cNumericLiteral(parseNumericLiteral('9223372036854775808', true), 'i64')).toBe(
      '(ssc__type__i64)-9223372036854775808wb',
    );
    expect(cNumericLiteral(parseNumericLiteral('0', true), 'i32')).toBe('(ssc__type__i32)0uwb');
  });
});

describe('literalInteger', () => {
  test.each([
    ['1e3', '1000'],
    ['1e-1000', '0'],
    ['1.0000000000000000001', '1'],
    ['0.99999999999999999999', '1'],
    ['9.223372036854775807e18', '9223372036854775807'],
    ['18446744073709551617', '18446744073709551617'],
    ['1.844674407370955e19', '18446744073709550000'],
    ['1e1000', `1${'0'.repeat(1000)}`],
    ['9.2233720368547758075e18', '9223372036854775808'],
  ])('%s', (text, expected) => {
    expect(literalInteger(parseNumericLiteral(text, false))?.toFixed()).toBe(expected);
  });

  test.each(['1.5', '1e-3', '1.5e-300'])('%s is not an integer', (text) => {
    expect(literalInteger(parseNumericLiteral(text, false))).toBeUndefined();
  });

  test('the f64 integer is exact for every large power of two', () => {
    // `.4`는 반 ulp보다 작아 f64로 읽으면 2의 거듭제곱 그대로다. 기대값은 BigInt로 만든다.
    for (let exponent = 54; exponent <= 1023; exponent++) {
      const expected = BigInt(2 ** exponent).toString();

      expect(literalInteger(parseNumericLiteral(`${expected}.4`, false))?.toFixed()).toBe(expected);
    }
  });
});
