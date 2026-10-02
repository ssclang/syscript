import { describe, expect, test } from 'vitest';
import { isLintEnabled, lintUnnecessaryOption } from '~/lint.js';
import { type InputCliOption, ZCliOption, ZlintKeyEnum } from '~/option.js';

const ABSENT = Symbol('absent');

const all = ZlintKeyEnum.options;

const debugValues = [ABSENT, undefined, true, false] as const;

const lintValues = [
  ABSENT,
  undefined,
  true,
  false,
  {},
  { enable: [] },
  { enable: all },
  { disable: [] },
  { disable: all },
  { enable: [], disable: [] },
  { enable: all, disable: [] },
  { enable: [], disable: all },
  { enable: all, disable: all },
] as const;

type Case = {
  name: string;
  option: InputCliOption;
  expected: { empty: boolean; keys: string[] };
};

function show(value: unknown) {
  if (value === ABSENT) {
    return '(absent)';
  }

  // JSON.stringify(undefined)는 타입과 달리 undefined를 돌려준다
  return value === undefined ? 'undefined' : JSON.stringify(value);
}

/**
 * 기대값은 구현과 별개로 규칙에서 계산한다.
 * - 값을 적지 않았거나 `undefined`면 보고하지 않는다.
 * - 배열은 비교하지 않으므로, 배열만 담은 객체 입력은 결과가 기본값과 같아도 보고하지 않는다.
 * - 원시값이나 빈 객체는 파싱 결과가 기본값과 같을 때 보고한다. `debug`의 기본값은 `false`,
 *   `lint`의 기본값은 `false`이며 `{}`는 전부 켜짐이라 기본값과 다르다.
 */
function buildCases() {
  const cases: Case[] = [];

  for (const debug of debugValues) {
    for (const lint of lintValues) {
      const option: Record<string, unknown> = {};
      const keys: string[] = [];

      if (debug !== ABSENT) {
        option['debug'] = debug;
        if (debug === false) {
          keys.push('debug');
        }
      }

      if (lint !== ABSENT) {
        option['lint'] = lint;
        if (lint === false) {
          keys.push('lint');
        }
      }

      cases.push({
        name: `debug=${show(debug)} lint=${show(lint)}`,
        option,
        expected: { empty: !Object.keys(option).length, keys },
      });
    }
  }

  return cases;
}

/**
 * 기대값 규칙:
 * - 적지 않았거나 `undefined`, `false`면 꺼짐 (기본값이 `false`)
 * - `true`면 켜짐
 * - 객체면 `enable`(생략 시 전체)에 있고 `disable`(생략 시 없음)에 없을 때 켜짐
 */
function expectedLintEnabled(lint: (typeof lintValues)[number]) {
  if (lint === ABSENT || lint === undefined || lint === false) {
    return false;
  }

  if (lint === true) {
    return true;
  }

  const enable: readonly string[] = 'enable' in lint ? lint.enable : all;
  const disable: readonly string[] = 'disable' in lint ? lint.disable : [];

  return enable.includes('unnecessary-option') && !disable.includes('unnecessary-option');
}

describe('isLintEnabled', () => {
  test.each(lintValues.map((lint) => ({ name: show(lint), lint })))('lint=$name', ({ lint }) => {
    const option = lint === ABSENT ? {} : { lint };
    const normalized = ZCliOption.parse(option);

    expect(isLintEnabled(normalized, 'unnecessary-option')).toBe(expectedLintEnabled(lint));
  });
});

describe('lintUnnecessaryOption', () => {
  test('undefined option', () => {
    expect(lintUnnecessaryOption(undefined)).toEqual({ empty: false, keys: [] });
  });

  test.each(buildCases())('$name', ({ option, expected }) => {
    expect(lintUnnecessaryOption(option)).toEqual(expected);
  });
});
