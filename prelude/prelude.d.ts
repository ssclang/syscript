/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type */

// ssc:include:prelude.h
// ssc:link:prelude.c

/// <reference path="guard.ts" />

export {};

declare global {
  /** `-128` ~ `127` */
  type i8 = number & {};
  /** `-32768` ~ `32767` */
  type i16 = number & {};
  /** `-2147483648` ~ `2147483647` */
  type i32 = number & {};
  /** `-9223372036854775808` ~ `9223372036854775807` */
  type i64 = number & {};

  /** `0` ~ `255` */
  type u8 = number & {};
  /** `0` ~ `65535` */
  type u16 = number & {};
  /** `0` ~ `4294967295` */
  type u32 = number & {};
  /** `0` ~ `18446744073709551615` */
  type u64 = number & {};

  /** `-16777216` ~ `16777216` (exact integers)\
   * fractions may lose precision
   */
  type f32 = number & {};
  /** `-9007199254740992` ~ `9007199254740992` (exact integers)\
   * fractions may lose precision
   */
  type f64 = number & {};

  type SscSignedIntegerType = i8 | i16 | i32 | i64;
  type SscUnsignedIntegerType = u8 | u16 | u32 | u64;
  type SscIntegerType = SscSignedIntegerType | SscUnsignedIntegerType;
  type SscFloatType = f32 | f64;
  type SscNumberType = SscIntegerType | SscFloatType;

  function addWrap<T extends SscIntegerType>(left: T, right: T): T;
  function subWrap<T extends SscIntegerType>(left: T, right: T): T;
  function mulWrap<T extends SscIntegerType>(left: T, right: T): T;

  class Pointer<V> {
    static ref<T>(value: T): Pointer<T>;
    read(): V;
    write(value: V): void;
  }

  // js built-in
  interface Array {}
  interface Boolean {}
  interface CallableFunction {}
  interface Function {}
  interface IArguments {}
  interface NewableFunction {}
  interface Number {}
  interface Object {}
  interface RegExp {}
  interface String {}
}
