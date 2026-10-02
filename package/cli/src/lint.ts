import { assert } from '@syscript/share';
import util from 'util';
import z from 'zod';
import { logWarn } from '~/log.js';
import { type InputCliOption, type LintKey, type OutputCliOption, ZCliOption } from '~/option.js';

function lintMessage(key: LintKey, value: unknown) {
  return `[lint:${key}]: ${JSON.stringify(value)}`;
}

export function isLintEnabled(option: OutputCliOption, key: LintKey) {
  return option.lint.enable.includes(key) && !option.lint.disable.includes(key);
}

function isEmptyPlainObject(value: unknown) {
  return z.util.isPlainObject(value) && !Object.keys(value).length;
}

function findUnnecessaryOptionKeys(
  input: Record<PropertyKey, unknown>,
  normalizedOption: Record<PropertyKey, unknown>,
  defaults: Record<PropertyKey, unknown>,
  keys: string[],
  found: string[],
) {
  const inputKeys = Object.keys(input);

  assert(inputKeys.length, 'input should not be empty');

  for (const key of inputKeys) {
    const inputValue = input[key];
    const normalizedValue = normalizedOption[key];
    const defaultValue = defaults[key];

    if (inputValue === undefined || Array.isArray(inputValue)) {
      continue;
    }

    if (z.util.isPlainObject(inputValue) && !isEmptyPlainObject(inputValue)) {
      assert(z.util.isPlainObject(normalizedValue), 'normalized value should be plain object');
      assert(z.util.isPlainObject(defaultValue), 'default value should be plain object');

      keys.push(key);
      findUnnecessaryOptionKeys(inputValue, normalizedValue, defaultValue, keys, found);
      keys.pop();
      continue;
    }

    if (util.isDeepStrictEqual(normalizedValue, defaultValue)) {
      found.push([...keys, key].join('.'));
    }
  }
}

export function lintUnnecessaryOption(option: InputCliOption | undefined) {
  if (!option) {
    return { empty: false, keys: [] };
  }

  if (!Object.keys(option).length) {
    return { empty: true, keys: [] };
  }

  const normalizedOption = ZCliOption.parse(option);
  const defaultOption = ZCliOption.parse({});
  const keys: string[] = [];

  findUnnecessaryOptionKeys(option, normalizedOption, defaultOption, [], keys);

  return { empty: false, keys };
}

export function tryLintUnnecessaryOption(
  option: InputCliOption | undefined,
  normalizedOption: OutputCliOption,
) {
  if (!isLintEnabled(normalizedOption, 'unnecessary-option')) {
    return;
  }

  const { empty, keys } = lintUnnecessaryOption(option);

  if (empty) {
    logWarn(lintMessage('unnecessary-option', 'option is empty'));
    return;
  }

  if (keys.length) {
    logWarn(lintMessage('unnecessary-option', keys));
  }
}
