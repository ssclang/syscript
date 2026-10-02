export type AnyString<T extends string> = T | (string & {});

export type StrictString<T> =
  T extends string ?
    string extends T ?
      never
    : T
  : T;

export type MaybePromise<T = unknown> = T | Promise<T>;

export type ValueOf<T> = T[keyof T];

export type UnknownFunction = (...args: unknown[]) => unknown;

export type ExtractLiteral<T extends string, Prefix extends string, Suffix extends string> =
  T extends `${Prefix}${infer Literal}${Suffix}` ? Literal : never;

export type OverloadParameters<T> =
  T extends (
    {
      (...args: infer P1): unknown;
      (...args: infer P2): unknown;
    }
  ) ?
    P1 | P2
  : T extends (...args: infer P) => unknown ? P
  : never;

export type ClassType<T> = new (...args: any[]) => T; // eslint-disable-line @typescript-eslint/no-explicit-any

export type AbstractOrClassType<T> = abstract new (...args: any[]) => T; // eslint-disable-line @typescript-eslint/no-explicit-any

export type Join<T extends readonly string[], Separator extends string> =
  T extends readonly [infer F extends string, ...infer R extends readonly string[]] ?
    R['length'] extends 0 ?
      F
    : `${F}${Separator}${Join<R, Separator>}`
  : '';

export type Replace<T extends string, From extends string, To extends string> =
  T extends `${infer S1}${From}${infer S2}` ? `${S1}${To}${Replace<S2, From, To>}` : T;

export type RemovePrefix<T, Prefix extends string> =
  T extends `${Prefix}${infer Suffix}` ? Suffix : T;

export type StrictOmit<T, K extends keyof T> = Omit<T, K>;

export type NonEmptyArray<T> = readonly [T, ...T[]];
