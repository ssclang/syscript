#pragma once

#include "prelude.h"

typedef struct ssc__struct__string {
  ssc__type__u64 length;
  char bytes[];
} ssc__struct__string;

static_assert(sizeof(ssc__struct__string) == 8);

static inline ssc__type__u64 ssc__fn__string_length(ssc__type__string value) {
  return value->length;
}

static inline ssc__type__boolean ssc__fn__string_equals(ssc__type__string left, ssc__type__string right) {
  return left->length == right->length && __builtin_memcmp(left->bytes, right->bytes, left->length) == 0;
}

static inline ssc__type__i32 ssc__fn__string_compare(ssc__type__string left, ssc__type__string right) {
  ssc__type__u64 length = left->length < right->length ? left->length : right->length;
  ssc__type__i32 result = __builtin_memcmp(left->bytes, right->bytes, length);

  if (result != 0) {
    return result;
  }

  return (left->length > right->length) - (left->length < right->length);
}
