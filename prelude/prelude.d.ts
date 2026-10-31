/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type */

/// <reference path="guard.ts" />

export {};

declare const ssc: unique symbol;

declare global {
  /** `-128` ~ `127` */
  type i8 = number & { readonly [ssc]: 'i8' };
  /** `-32768` ~ `32767` */
  type i16 = number & { readonly [ssc]: 'i16' };
  /** `-2147483648` ~ `2147483647` */
  type i32 = number & { readonly [ssc]: 'i32' };
  /** `-9223372036854775808` ~ `9223372036854775807` */
  type i64 = number & { readonly [ssc]: 'i64' };

  /** `0` ~ `255` */
  type u8 = number & { readonly [ssc]: 'u8' };
  /** `0` ~ `65535` */
  type u16 = number & { readonly [ssc]: 'u16' };
  /** `0` ~ `4294967295` */
  type u32 = number & { readonly [ssc]: 'u32' };
  /** `0` ~ `18446744073709551615` */
  type u64 = number & { readonly [ssc]: 'u64' };

  /** `0` ~ `0xD7FF`, `0xE000` ~ `0x10FFFF` */
  type char = number & { readonly [ssc]: 'char' };

  /** `-16777216` ~ `16777216` (exact integers)\
   * fractions may lose precision
   */
  type f32 = number & { readonly [ssc]: 'f32' };
  /** `-9007199254740992` ~ `9007199254740992` (exact integers)\
   * fractions may lose precision
   */
  type f64 = number;

  type SscSignedIntegerType = i8 | i16 | i32 | i64;
  type SscUnsignedIntegerType = u8 | u16 | u32 | u64;
  type SscIntegerType = SscSignedIntegerType | SscUnsignedIntegerType;
  type SscFloatType = f32 | f64;
  type SscNumberType = SscIntegerType | SscFloatType | char;

  function i8(value: number | string): i8;
  function i16(value: number | string): i16;
  function i32(value: number | string): i32;
  function i64(value: number | string): i64;
  function u8(value: number | string): u8;
  function u16(value: number | string): u16;
  function u32(value: number | string): u32;
  function u64(value: number | string): u64;
  function char(value: number | string): char;
  function f32(value: number | string): f32;
  function f64(value: number | string): f64;

  function addWrap<T extends SscIntegerType>(left: T, right: T): T;
  function subWrap<T extends SscIntegerType>(left: T, right: T): T;
  function mulWrap<T extends SscIntegerType>(left: T, right: T): T;

  const process: {
    readonly stdout: {
      write(text: string): void;
    };
    readonly stderr: {
      write(text: string): void;
    };
  };

  const console: {
    log(...values: unknown[]): void;
    error(...values: unknown[]): void;
  };

  class Pointer<V> {
    static ref<T>(value: T): Pointer<T>;
    read(): V;
    write(value: V): void;
  }

  // js built-in
  interface Array<T> {
    readonly length: u64;

    [index: number]: T;

    push(...values: T[]): u64;
    pop(): T | undefined;

    forEach(callback: (value: T, index: u64, array: T[]) => void): void;
    map<U>(callback: (value: T, index: u64, array: T[]) => U): U[];
    filter(callback: (value: T, index: u64, array: T[]) => boolean): T[];
    reduce<U>(callback: (accumulator: U, value: T, index: u64, array: T[]) => U, initial: U): U;
    find(callback: (value: T, index: u64, array: T[]) => boolean): T | undefined;
    some(callback: (value: T, index: u64, array: T[]) => boolean): boolean;
    every(callback: (value: T, index: u64, array: T[]) => boolean): boolean;
    indexOf(value: T): i64;
  }
  interface Boolean {}
  interface CallableFunction {}
  interface Function {}
  interface IArguments {}
  interface NewableFunction {}
  interface Number {}
  interface Object {}
  interface RegExp {}
  interface String {
    readonly length: u64;
  }
}
