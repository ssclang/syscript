import { expect, test } from 'vitest';
import { CppCStringLiteral, CppStringLiteral } from '~/cpp/node.js';

/**
 * 문자열 리터럴 안에 그대로 두면 컴파일 에러나 경고가 나는 문자만 8진수로 바꾼다.
 * 나머지 제어 문자, `?` 하나, UTF-8 문자는 그대로 둔다.
 */
const cases = {
  // region 그대로 두면 에러
  '"': '\\042',
  '\n': '\\012',
  '\r': '\\015',

  // region 그대로 두면 경고. 뒤에 문자가 오는 `??`는 트라이그래프가 아니어도 바꾼다
  '\\': '\\134',
  '\0': '\\000',
  '??=': '\\077?=',
  "??/??'??(??)??!??<??>??-": "\\077?/\\077?'\\077?(\\077?)\\077?!\\077?<\\077?>\\077?-",
  '???=': '\\077\\077?=',
  '??a': '\\077?a',

  // region 그대로 둔다
  'a?b': 'a?b',
  'a??': 'a??',
  '\t\v\f\x01\x1f\x7f': '\t\v\f\x01\x1f\x7f',
  '한글😀': '한글😀',
  '\u2028': '\u2028',
  '': '',
} as const satisfies Record<string, string>;

test.each(Object.entries(cases))('%j', (value, escaped) => {
  expect(new CppCStringLiteral(value).code()).toBe(`"${escaped}"`);
  expect(new CppStringLiteral(value).code()).toBe(
    `ssc__core__fn__string_literal<u8"${escaped}">()`,
  );
});
