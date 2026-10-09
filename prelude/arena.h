#pragma once

#include "prelude.h"

typedef struct ssc__arena_chunk {
  struct ssc__arena_chunk *following;
  char *limit;
} ssc__type__arena_chunk;

typedef struct ssc__arena {
  char *next;
  char *limit;
  ssc__type__arena_chunk *chunk;
  ssc__type__arena_chunk *first;
  char *start;
  ssc__type__u64 next_chunk_size;
  struct ssc__arena *next_free;
} ssc__type__arena;

typedef struct ssc__arena_checkpoint {
  ssc__type__arena_chunk *chunk;
  char *next;
} ssc__type__arena_checkpoint;

enum : ssc__type__u64 {
  ssc__slab_page_shift = 12,
  ssc__slab_segment_shift = 26,
  ssc__slab_segment_page_count = (ssc__type__u64)1 << (26 - 12),
  ssc__slab_segment_count = (ssc__type__u64)1 << (48 - 26),
};

typedef struct ssc__slab_segment {
  ssc__type__arena *pages[ssc__slab_segment_page_count];
  ssc__type__u8 classes[ssc__slab_segment_page_count];
} ssc__type__slab_segment;

extern ssc__type__slab_segment *ssc__slab_segments[ssc__slab_segment_count];

ssc__type__arena *ssc__fn__arena_acquire(void);
void ssc__fn__arena_release(ssc__type__arena *arena);
void *ssc__fn__arena_grow(ssc__type__arena *arena, ssc__type__u64 size);
ssc__type__u64 ssc__fn__slab_mapped_bytes(void);

static inline void *ssc__fn__arena_alloc(ssc__type__arena *arena, ssc__type__u64 size) {
  size = (size + 7) & ~(ssc__type__u64)7;

  if (__builtin_expect(size > (ssc__type__u64)(arena->limit - arena->next), false)) {
    return ssc__fn__arena_grow(arena, size);
  }

  void *result = arena->next;

  arena->next += size;

  return result;
}

static inline ssc__type__arena_checkpoint ssc__fn__arena_checkpoint(ssc__type__arena *arena) {
  return (ssc__type__arena_checkpoint){.chunk = arena->chunk, .next = arena->next};
}

static inline void ssc__fn__arena_rollback(ssc__type__arena *arena, ssc__type__arena_checkpoint checkpoint) {
  arena->chunk = checkpoint.chunk;
  arena->next = checkpoint.next;
  arena->limit = checkpoint.chunk->limit;
}

static inline void ssc__fn__arena_reset(ssc__type__arena *arena) {
  arena->chunk = arena->first;
  arena->next = arena->start;
  arena->limit = arena->first->limit;
}

static inline ssc__type__arena *ssc__fn__arena_of(const void *pointer) {
  ssc__type__u64 index = (__UINTPTR_TYPE__)pointer >> ssc__slab_segment_shift;

  if (index >= ssc__slab_segment_count) {
    return nullptr;
  }

  ssc__type__slab_segment *segment = ssc__slab_segments[index];

  if (!segment) {
    return nullptr;
  }

  return segment->pages[((__UINTPTR_TYPE__)pointer >> ssc__slab_page_shift) & (ssc__slab_segment_page_count - 1)];
}
