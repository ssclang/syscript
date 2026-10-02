#include <stdio.h>
#include <stdlib.h>

#include "prelude.h"

/* 메시지와 종료 코드는 Node에서 잡히지 않은 ReferenceError와 같다. */
[[noreturn]] void ssc__fn__throw_tdz_error(const char *name) {
  fprintf(stderr, "ReferenceError: Cannot access '%s' before initialization\n", name);
  exit(1);
}
