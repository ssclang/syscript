/* eslint-disable @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type */

// ssc:include:prelude.h
// ssc:link:prelude.c

export {};

/*
 * `number` 그대로 두면 tsc가 전역 number 타입을 재사용해 별칭 정보를 잃는다.
 * `& {}`를 붙이면 교차 타입이라 타입 객체가 새로 생겨 aliasSymbol에 이름이 남는다.
 * `{}`는 요구 멤버가 없어 number를 그대로 받으므로 연산과 대입은 그대로 동작한다.
 */

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

  class Pointer<V> {
    static ref<T>(value: T): Pointer<T>;
    read(): V;
    write(value: V): void;
  }
}
