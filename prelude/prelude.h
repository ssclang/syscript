#pragma once

static_assert(sizeof(__SIZE_TYPE__) == 8);
static_assert(sizeof(void *) == 8);

static_assert(__INT8_MAX__ == 127);
static_assert(__INT16_MAX__ == 32767);
static_assert(__INT32_MAX__ == 2147483647);
static_assert(__INT64_MAX__ == 9223372036854775807);
static_assert(__UINT8_MAX__ == 255U);
static_assert(__UINT16_MAX__ == 65535U);
static_assert(__UINT32_MAX__ == 4294967295U);
static_assert(__UINT64_MAX__ == 18446744073709551615U);

typedef __INT8_TYPE__ ssc__type__i8;
typedef __INT16_TYPE__ ssc__type__i16;
typedef __INT32_TYPE__ ssc__type__i32;
typedef __INT64_TYPE__ ssc__type__i64;
typedef __UINT8_TYPE__ ssc__type__u8;
typedef __UINT16_TYPE__ ssc__type__u16;
typedef __UINT32_TYPE__ ssc__type__u32;
typedef __UINT64_TYPE__ ssc__type__u64;
typedef float ssc__type__f32;
typedef double ssc__type__f64;
typedef bool ssc__type__boolean;

static_assert(sizeof(ssc__type__i8) == 1);
static_assert(sizeof(ssc__type__i16) == 2);
static_assert(sizeof(ssc__type__i32) == 4);
static_assert(sizeof(ssc__type__i64) == 8);
static_assert(sizeof(ssc__type__u8) == 1);
static_assert(sizeof(ssc__type__u16) == 2);
static_assert(sizeof(ssc__type__u32) == 4);
static_assert(sizeof(ssc__type__u64) == 8);
static_assert(sizeof(ssc__type__f32) == 4);
static_assert(sizeof(ssc__type__f64) == 8);
static_assert(sizeof(ssc__type__boolean) == 1);

/*
 * JS의 참거짓 판정. C의 `x != 0`은 NaN을 참으로 보지만 JS는 거짓으로 본다. 정수는 비교
 * 하나로 끝나므로 호출부에서 바로 쓴다.
 */
static inline ssc__type__boolean ssc__fn__truthy_f32(ssc__type__f32 x) { return !__builtin_isnan(x) && x != 0; }
static inline ssc__type__boolean ssc__fn__truthy_f64(ssc__type__f64 x) { return !__builtin_isnan(x) && x != 0; }

/*
 * 아래는 컴파일러가 생성 코드에서 부르는 내부 런타임. `.d.ts`로 노출하지 않는다. 선언만 두고
 * 본체는 prelude.c에 있다. libc는 prelude.c에서만 쓰므로 이 헤더를 include해도 libc 선언이
 * 들어오지 않는다.
 */

/*
 * 초기화 전(TDZ)의 최상위 변수에 접근했다. JS처럼 ReferenceError를 던진다. 아직 try/catch가
 * 없어 잡히지 않은 예외처럼 프로세스를 끝낸다. 예외를 구현하면 실제로 던지게 바꾼다.
 */
[[noreturn]] void ssc__fn__throw_tdz_error(const char *name);

/*
 * 선언 전에 접근될 수 있는 최상위 변수에만 붙는 검사. 초기화가 끝난 뒤에는 늘 통과하므로
 * 분기 예측이 거의 항상 맞는다.
 */
static inline void ssc__fn__validate_tdz(bool initialized, const char *name) {
  if (__builtin_expect(!initialized, false)) {
    ssc__fn__throw_tdz_error(name);
  }
}

/* 정수 연산이 결과 타입에 담기지 않는다(넘침, 0으로 나누기). */
[[noreturn]] void ssc__fn__throw_arithmetic_error(const char *message);

/*
 * 정수 연산. 결과 타입은 피연산자 타입이고, 담기지 않으면 에러다. C의 `+`는 int보다 작은 타입을
 * int로 승격하고 부호 있는 넘침이 UB라, 승격이 없는 같은 폭의 `_BitInt`로 계산한다. 나눗셈은
 * 0과 `MIN / -1`(부호 있는 타입만)을 먼저 막는다. `*_wrap`은 검사 없이 감긴 값을 돌려준다.
 */
#define SSC__MACRO__ARITHMETIC_FN(SSC_TYPE, BIT_INT, MIN_VALUE) \
  static inline ssc__type__##SSC_TYPE ssc__fn__add_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    BIT_INT result; \
    if (__builtin_expect(__builtin_add_overflow((BIT_INT)left, (BIT_INT)right, &result), false)) { \
      ssc__fn__throw_arithmetic_error("Overflow: " #SSC_TYPE); \
    } \
    return result; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__sub_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    BIT_INT result; \
    if (__builtin_expect(__builtin_sub_overflow((BIT_INT)left, (BIT_INT)right, &result), false)) { \
      ssc__fn__throw_arithmetic_error("Overflow: " #SSC_TYPE); \
    } \
    return result; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__mul_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    BIT_INT result; \
    if (__builtin_expect(__builtin_mul_overflow((BIT_INT)left, (BIT_INT)right, &result), false)) { \
      ssc__fn__throw_arithmetic_error("Overflow: " #SSC_TYPE); \
    } \
    return result; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__div_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    if (__builtin_expect(right == 0, false)) { \
      ssc__fn__throw_arithmetic_error("Division by zero: " #SSC_TYPE); \
    } \
    if (__builtin_expect(MIN_VALUE < 0 && left == MIN_VALUE && right == (ssc__type__##SSC_TYPE)-1, false)) { \
      ssc__fn__throw_arithmetic_error("Overflow: " #SSC_TYPE); \
    } \
    return (BIT_INT)left / (BIT_INT)right; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__rem_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    if (__builtin_expect(right == 0, false)) { \
      ssc__fn__throw_arithmetic_error("Division by zero: " #SSC_TYPE); \
    } \
    /* `MIN % -1` is mathematically 0 but UB in C */ \
    if (MIN_VALUE < 0 && left == MIN_VALUE && right == (ssc__type__##SSC_TYPE)-1) { \
      return 0; \
    } \
    return (BIT_INT)left % (BIT_INT)right; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__increment_prefix_##SSC_TYPE(ssc__type__##SSC_TYPE *target) { \
    *target = ssc__fn__add_##SSC_TYPE(*target, 1); \
    return *target; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__increment_postfix_##SSC_TYPE(ssc__type__##SSC_TYPE *target) { \
    ssc__type__##SSC_TYPE previous = *target; \
    *target = ssc__fn__add_##SSC_TYPE(previous, 1); \
    return previous; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__decrement_prefix_##SSC_TYPE(ssc__type__##SSC_TYPE *target) { \
    *target = ssc__fn__sub_##SSC_TYPE(*target, 1); \
    return *target; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__decrement_postfix_##SSC_TYPE(ssc__type__##SSC_TYPE *target) { \
    ssc__type__##SSC_TYPE previous = *target; \
    *target = ssc__fn__sub_##SSC_TYPE(previous, 1); \
    return previous; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__bitwise_not_##SSC_TYPE(ssc__type__##SSC_TYPE value) { \
    return ~(BIT_INT)value; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__bitwise_and_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    return (BIT_INT)left & (BIT_INT)right; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__bitwise_or_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    return (BIT_INT)left | (BIT_INT)right; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__bitwise_xor_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    return (BIT_INT)left ^ (BIT_INT)right; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__add_wrap_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    BIT_INT result; \
    __builtin_add_overflow((BIT_INT)left, (BIT_INT)right, &result); \
    return result; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__sub_wrap_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    BIT_INT result; \
    __builtin_sub_overflow((BIT_INT)left, (BIT_INT)right, &result); \
    return result; \
  } \
\
  static inline ssc__type__##SSC_TYPE ssc__fn__mul_wrap_##SSC_TYPE(ssc__type__##SSC_TYPE left, ssc__type__##SSC_TYPE right) { \
    BIT_INT result; \
    __builtin_mul_overflow((BIT_INT)left, (BIT_INT)right, &result); \
    return result; \
  }

SSC__MACRO__ARITHMETIC_FN(i8, _BitInt(8), (-__INT8_MAX__ - 1))
SSC__MACRO__ARITHMETIC_FN(i16, _BitInt(16), (-__INT16_MAX__ - 1))
SSC__MACRO__ARITHMETIC_FN(i32, _BitInt(32), (-__INT32_MAX__ - 1))
SSC__MACRO__ARITHMETIC_FN(i64, _BitInt(64), (-__INT64_MAX__ - 1))
SSC__MACRO__ARITHMETIC_FN(u8, unsigned _BitInt(8), 0)
SSC__MACRO__ARITHMETIC_FN(u16, unsigned _BitInt(16), 0)
SSC__MACRO__ARITHMETIC_FN(u32, unsigned _BitInt(32), 0)
SSC__MACRO__ARITHMETIC_FN(u64, unsigned _BitInt(64), 0)

#undef SSC__MACRO__ARITHMETIC_FN
