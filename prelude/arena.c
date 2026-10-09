#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>

#include "arena.h"

enum : ssc__type__u64 {
  ssc__slab_class_count = 64,
  ssc__slab_page_size = (ssc__type__u64)1 << ssc__slab_page_shift,
  ssc__slab_segment_size = (ssc__type__u64)1 << ssc__slab_segment_shift,
  ssc__arena_first_chunk_size = 4096,
  ssc__arena_second_chunk_size = 8192,
};

ssc__type__slab_segment *ssc__slab_segments[ssc__slab_segment_count];

static ssc__type__arena_chunk *ssc__slab_free_lists[ssc__slab_class_count];
static char *ssc__slab_current;
static char *ssc__slab_current_end;
static ssc__type__u64 ssc__slab_mapped;
static ssc__type__arena *ssc__arena_free_list;

[[noreturn]] static void ssc__fn__throw_out_of_memory(void) {
  fprintf(stderr, "FATAL ERROR: Allocation failed - out of memory\n");
  exit(1);
}

static void *ssc__fn__slab_map(ssc__type__u64 size) {
  void *memory = mmap(nullptr, size, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS | MAP_NORESERVE, -1, 0);

  if (memory == MAP_FAILED) {
    ssc__fn__throw_out_of_memory();
  }

  return memory;
}

static char *ssc__fn__slab_map_segments(ssc__type__u64 segment_count) {
  ssc__type__u64 size = segment_count * ssc__slab_segment_size;
  char *raw = ssc__fn__slab_map(size + ssc__slab_segment_size);
  char *aligned = (char *)(((__UINTPTR_TYPE__)raw + ssc__slab_segment_size - 1) & ~(__UINTPTR_TYPE__)(ssc__slab_segment_size - 1));
  char *raw_end = raw + size + ssc__slab_segment_size;

  if (aligned > raw) {
    munmap(raw, (ssc__type__u64)(aligned - raw));
  }

  if (raw_end > aligned + size) {
    munmap(aligned + size, (ssc__type__u64)(raw_end - (aligned + size)));
  }

  if (((__UINTPTR_TYPE__)(aligned + size - 1) >> ssc__slab_segment_shift) >= ssc__slab_segment_count) {
    ssc__fn__throw_out_of_memory();
  }

  for (ssc__type__u64 i = 0; i < segment_count; i++) {
    ssc__slab_segments[(__UINTPTR_TYPE__)(aligned + i * ssc__slab_segment_size) >> ssc__slab_segment_shift] =
      ssc__fn__slab_map(sizeof(ssc__type__slab_segment));
  }

  ssc__slab_mapped += size;

  return aligned;
}

static ssc__type__slab_segment *ssc__fn__slab_segment_of(const void *pointer) {
  return ssc__slab_segments[(__UINTPTR_TYPE__)pointer >> ssc__slab_segment_shift];
}

static ssc__type__u64 ssc__fn__slab_page_index(const void *pointer) {
  return ((__UINTPTR_TYPE__)pointer >> ssc__slab_page_shift) & (ssc__slab_segment_page_count - 1);
}

static ssc__type__arena_chunk *ssc__fn__slab_chunk_alloc(ssc__type__u64 size) {
  if (size > ((ssc__type__u64)1 << 46)) {
    ssc__fn__throw_out_of_memory();
  }

  ssc__type__u64 page_count = (size + ssc__slab_page_size - 1) >> ssc__slab_page_shift;
  ssc__type__u64 size_class = page_count <= 1 ? 0 : 64 - (ssc__type__u64)__builtin_clzll(page_count - 1);
  ssc__type__u64 chunk_size = ssc__slab_page_size << size_class;
  char *chunk = (char *)ssc__slab_free_lists[size_class];

  if (chunk) {
    ssc__slab_free_lists[size_class] = ((ssc__type__arena_chunk *)chunk)->following;
  } else if (chunk_size >= ssc__slab_segment_size) {
    chunk = ssc__fn__slab_map_segments(chunk_size / ssc__slab_segment_size);
  } else {
    if (ssc__slab_current + chunk_size > ssc__slab_current_end) {
      ssc__slab_current = ssc__fn__slab_map_segments(1);
      ssc__slab_current_end = ssc__slab_current + ssc__slab_segment_size;
    }

    chunk = ssc__slab_current;
    ssc__slab_current += chunk_size;
  }

  ssc__fn__slab_segment_of(chunk)->classes[ssc__fn__slab_page_index(chunk)] = (ssc__type__u8)size_class;

  ssc__type__arena_chunk *result = (ssc__type__arena_chunk *)chunk;

  result->following = nullptr;
  result->limit = chunk + chunk_size;

  return result;
}

static void ssc__fn__slab_chunk_free(ssc__type__arena_chunk *chunk) {
  ssc__type__u64 size_class = ssc__fn__slab_segment_of(chunk)->classes[ssc__fn__slab_page_index(chunk)];

  chunk->following = ssc__slab_free_lists[size_class];
  ssc__slab_free_lists[size_class] = chunk;
}

static void ssc__fn__slab_register(ssc__type__arena_chunk *chunk, ssc__type__arena *arena) {
  for (char *page = (char *)chunk; page < chunk->limit; page += ssc__slab_page_size) {
    ssc__fn__slab_segment_of(page)->pages[ssc__fn__slab_page_index(page)] = arena;
  }
}

static char *ssc__fn__arena_chunk_start(ssc__type__arena_chunk *chunk) {
  return (char *)(chunk + 1);
}

static void ssc__fn__arena_enter_chunk(ssc__type__arena *arena, ssc__type__arena_chunk *chunk) {
  arena->chunk = chunk;
  arena->next = ssc__fn__arena_chunk_start(chunk);
  arena->limit = chunk->limit;
}

static ssc__type__arena *ssc__fn__arena_create(void) {
  ssc__type__arena_chunk *first = ssc__fn__slab_chunk_alloc(ssc__arena_first_chunk_size);
  ssc__type__arena *arena = (ssc__type__arena *)ssc__fn__arena_chunk_start(first);

  arena->first = first;
  arena->start = (char *)(arena + 1);
  arena->next_free = nullptr;
  ssc__fn__slab_register(first, arena);

  return arena;
}

ssc__type__arena *ssc__fn__arena_acquire(void) {
  ssc__type__arena *arena = ssc__arena_free_list;

  if (arena) {
    ssc__arena_free_list = arena->next_free;
  } else {
    arena = ssc__fn__arena_create();
  }

  arena->next_chunk_size = ssc__arena_second_chunk_size;
  ssc__fn__arena_reset(arena);

  return arena;
}

void ssc__fn__arena_release(ssc__type__arena *arena) {
  ssc__type__arena_chunk *chunk = arena->first->following;

  while (chunk) {
    ssc__type__arena_chunk *following = chunk->following;

    ssc__fn__slab_chunk_free(chunk);
    chunk = following;
  }

  arena->first->following = nullptr;
  arena->next_free = ssc__arena_free_list;
  ssc__arena_free_list = arena;
}

void *ssc__fn__arena_grow(ssc__type__arena *arena, ssc__type__u64 size) {
  ssc__type__arena_chunk *following = arena->chunk->following;

  while (following && (ssc__type__u64)(following->limit - ssc__fn__arena_chunk_start(following)) < size) {
    ssc__type__arena_chunk *unused = following;

    following = following->following;
    ssc__fn__slab_chunk_free(unused);
  }

  if (!following) {
    ssc__type__u64 wanted = size + sizeof(ssc__type__arena_chunk);

    following = ssc__fn__slab_chunk_alloc(wanted > arena->next_chunk_size ? wanted : arena->next_chunk_size);
    ssc__fn__slab_register(following, arena);

    if (arena->next_chunk_size < ssc__slab_segment_size) {
      arena->next_chunk_size *= 2;
    }
  }

  arena->chunk->following = following;
  ssc__fn__arena_enter_chunk(arena, following);

  void *result = arena->next;

  arena->next += size;

  return result;
}

ssc__type__u64 ssc__fn__slab_mapped_bytes(void) {
  return ssc__slab_mapped;
}
