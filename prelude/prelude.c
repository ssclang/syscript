#include <stdio.h>
#include <stdlib.h>

#include "prelude.h"

/* 메시지와 종료 코드는 Node에서 잡히지 않은 ReferenceError와 같다. */
[[noreturn]] void ssc__fn__throw_tdz_error(const char *name) {
  fprintf(stderr, "ReferenceError: Cannot access '%s' before initialization\n", name);
  exit(1);
}

/* JS에는 정수 넘침이 없어 범위 에러인 RangeError로 낸다. */
[[noreturn]] void ssc__fn__throw_arithmetic_error(const char *message) {
  fprintf(stderr, "RangeError: %s\n", message);
  exit(1);
}

[[noreturn]] void ssc__fn__throw_union_error(const char *expected, ssc__type__u64 type_id) {
  const char *name = type_id < _Countof(ssc__type_names) ? ssc__type_names[type_id] : nullptr; // TODO: string

  if (name) {
    fprintf(stderr, "TypeError: Type '%s' is not assignable to type '%s'\n", name, expected);
  } else {
    fprintf(stderr, "TypeError: Type '#%llu' is not assignable to type '%s'\n", (unsigned long long)type_id, expected);
  }

  exit(1);
}

#include "arena.c"
