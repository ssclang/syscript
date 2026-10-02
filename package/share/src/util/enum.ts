import { assert } from './assert.js';

export class Enum {
  static parse<T extends Record<string, string>>(enumType: T, value: string): T[keyof T] {
    const isEnum = Object.values(enumType).includes(value);

    assert(isEnum);

    return value as T[keyof T];
  }
}
