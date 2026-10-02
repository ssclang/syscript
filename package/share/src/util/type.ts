import { Join, Replace } from '../type.js';

export class TypeUtil {
  static join<T extends string[], Separator extends string>(values: T, separator: Separator) {
    return values.join(separator) as Join<T, Separator>;
  }

  static replace<T extends string, From extends string, To extends string>(
    value: T,
    from: From,
    to: To,
  ) {
    return value.replaceAll(from, to) as Replace<T, From, To>;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  static mapReplace<T extends string[], From extends string, To extends string>(
    values: T,
    from: From,
    to: To,
  ) {
    return values.map((v) => v.replaceAll(from, to)) as {
      [I in keyof T]: T[I] extends string ? Replace<T[I], From, To> : T[I];
    };
  }

  static isArray<T>(value: T | T[]): value is T[] {
    return Array.isArray(value);
  }

  static asReadonly<T>(value: T[]): readonly T[] {
    return value;
  }
}
