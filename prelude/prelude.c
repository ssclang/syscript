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
