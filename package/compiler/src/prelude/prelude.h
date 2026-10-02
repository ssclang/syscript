#pragma once

/* 폭이 고정된 타입. 표준 헤더 없이 컴파일러 내장 매크로로 정의한다. */
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
 * JS의 참거짓 판정. C의 `x != 0`은 NaN을 참으로 보지만 JS는 거짓으로 본다.
 * `x == x`가 NaN에서만 거짓이라 그 차이를 메운다. 정수는 비교 하나로 끝나므로
 * 호출부에서 바로 쓴다.
 */
static inline ssc__type__boolean ssc__fn__truthy_f32(ssc__type__f32 x) { return x == x && x != 0; }
static inline ssc__type__boolean ssc__fn__truthy_f64(ssc__type__f64 x) { return x == x && x != 0; }

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
