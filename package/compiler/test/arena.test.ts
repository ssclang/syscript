import { expect, test } from 'vitest';
import { runC } from './helper/run-c.js';

/* 실패하면 그 줄 번호로 끝난다. */
const prologue = `
#define CHECK(condition) if (!(condition)) { return __LINE__; }

static int global_value;
`;

test.each([
  [
    'an allocation keeps its value and is 8-byte aligned',
    `
  ssc__type__arena *arena = ssc__fn__arena_acquire();
  ssc__type__u64 *value = ssc__fn__arena_alloc(arena, sizeof(ssc__type__u64));

  *value = 0xDEADBEEF;

  char *odd = ssc__fn__arena_alloc(arena, 3);
  char *after = ssc__fn__arena_alloc(arena, 8);

  CHECK(*value == 0xDEADBEEF);
  CHECK(((__UINTPTR_TYPE__)odd & 7) == 0);
  CHECK(((__UINTPTR_TYPE__)after & 7) == 0);
  CHECK(after - odd == 8);
`,
  ],
  [
    'every allocation maps back to its arena',
    `
  ssc__type__arena *first = ssc__fn__arena_acquire();
  ssc__type__arena *second = ssc__fn__arena_acquire();

  for (int i = 0; i < 20000; i++) {
    CHECK(ssc__fn__arena_of(ssc__fn__arena_alloc(first, 64)) == first);
    CHECK(ssc__fn__arena_of(ssc__fn__arena_alloc(second, 48)) == second);
  }

  char *large = ssc__fn__arena_alloc(first, 1 << 20);
  char *huge = ssc__fn__arena_alloc(second, (ssc__type__u64)100 << 20);

  CHECK(ssc__fn__arena_of(large) == first);
  CHECK(ssc__fn__arena_of(large + (1 << 20) - 1) == first);
  CHECK(ssc__fn__arena_of(huge) == second);
  CHECK(ssc__fn__arena_of(huge + ((ssc__type__u64)100 << 20) - 1) == second);
`,
  ],
  [
    'a pointer outside every arena maps to nothing',
    `
  int local = 0;

  ssc__fn__arena_alloc(ssc__fn__arena_acquire(), 64);

  CHECK(ssc__fn__arena_of(nullptr) == nullptr);
  CHECK(ssc__fn__arena_of(&local) == nullptr);
  CHECK(ssc__fn__arena_of(&global_value) == nullptr);
  CHECK(ssc__fn__arena_of("literal") == nullptr);
`,
  ],
  [
    'reset gives the first address again',
    `
  ssc__type__arena *arena = ssc__fn__arena_acquire();
  char *first = ssc__fn__arena_alloc(arena, 128);

  for (int i = 0; i < 5000; i++) {
    ssc__fn__arena_alloc(arena, 128);
  }

  ssc__fn__arena_reset(arena);
  CHECK(ssc__fn__arena_alloc(arena, 128) == first);
`,
  ],
  [
    'repeated reset does not map more memory',
    `
  ssc__type__arena *arena = ssc__fn__arena_acquire();

  for (int i = 0; i < 1000; i++) {
    ssc__fn__arena_alloc(arena, 64);
  }

  ssc__fn__arena_reset(arena);

  ssc__type__u64 before = ssc__fn__slab_mapped_bytes();

  for (int round = 0; round < 500; round++) {
    for (int i = 0; i < 1000; i++) {
      ssc__fn__arena_alloc(arena, 64);
    }

    ssc__fn__arena_reset(arena);
  }

  CHECK(ssc__fn__slab_mapped_bytes() == before);
`,
  ],
  [
    'rollback within a chunk and across chunks',
    `
  ssc__type__arena *arena = ssc__fn__arena_acquire();

  ssc__fn__arena_alloc(arena, 32);

  ssc__type__arena_checkpoint checkpoint = ssc__fn__arena_checkpoint(arena);
  char *first = ssc__fn__arena_alloc(arena, 128);

  for (int i = 0; i < 4; i++) {
    ssc__fn__arena_alloc(arena, 128);
  }

  ssc__fn__arena_rollback(arena, checkpoint);
  CHECK(ssc__fn__arena_alloc(arena, 128) == first);

  ssc__fn__arena_rollback(arena, checkpoint);

  for (int i = 0; i < 20000; i++) {
    ssc__fn__arena_alloc(arena, 128);
  }

  ssc__fn__arena_rollback(arena, checkpoint);
  CHECK(ssc__fn__arena_alloc(arena, 128) == first);
`,
  ],
  [
    'nested checkpoints roll back in order',
    `
  ssc__type__arena *arena = ssc__fn__arena_acquire();
  ssc__type__arena_checkpoint outer = ssc__fn__arena_checkpoint(arena);
  char *outer_first = ssc__fn__arena_alloc(arena, 64);

  for (int i = 0; i < 3000; i++) {
    ssc__fn__arena_alloc(arena, 64);
  }

  ssc__type__arena_checkpoint inner = ssc__fn__arena_checkpoint(arena);
  char *inner_first = ssc__fn__arena_alloc(arena, 64);

  for (int i = 0; i < 3000; i++) {
    ssc__fn__arena_alloc(arena, 64);
  }

  ssc__fn__arena_rollback(arena, inner);
  CHECK(ssc__fn__arena_alloc(arena, 64) == inner_first);

  ssc__fn__arena_rollback(arena, outer);
  CHECK(ssc__fn__arena_alloc(arena, 64) == outer_first);
`,
  ],
  [
    'rollback after a huge allocation',
    `
  ssc__type__arena *arena = ssc__fn__arena_acquire();

  for (int i = 0; i < 50000; i++) {
    ssc__fn__arena_alloc(arena, 64);
  }

  ssc__type__arena_checkpoint checkpoint = ssc__fn__arena_checkpoint(arena);
  char *first = ssc__fn__arena_alloc(arena, 64);

  ssc__fn__arena_rollback(arena, checkpoint);
  ssc__fn__arena_alloc(arena, 8 << 20);
  ssc__fn__arena_rollback(arena, checkpoint);
  CHECK(ssc__fn__arena_alloc(arena, 64) == first);
`,
  ],
  [
    'loop rollback does not map more memory',
    `
  ssc__type__arena *arena = ssc__fn__arena_acquire();
  ssc__type__arena_checkpoint checkpoint = ssc__fn__arena_checkpoint(arena);

  for (int i = 0; i < 1000; i++) {
    for (int j = 0; j < 2000; j++) {
      ssc__fn__arena_alloc(arena, 64);
    }

    ssc__fn__arena_rollback(arena, checkpoint);
  }

  ssc__type__u64 before = ssc__fn__slab_mapped_bytes();

  for (int i = 0; i < 1000; i++) {
    for (int j = 0; j < 2000; j++) {
      ssc__fn__arena_alloc(arena, 64);
    }

    ssc__fn__arena_rollback(arena, checkpoint);
  }

  CHECK(ssc__fn__slab_mapped_bytes() == before);
`,
  ],
  [
    'a released arena is reused without mapping more memory',
    `
  ssc__type__arena *arena = ssc__fn__arena_acquire();

  for (int i = 0; i < 100000; i++) {
    ssc__fn__arena_alloc(arena, 64);
  }

  ssc__fn__arena_release(arena);

  ssc__type__u64 before = ssc__fn__slab_mapped_bytes();

  for (int round = 0; round < 100; round++) {
    ssc__type__arena *reused = ssc__fn__arena_acquire();

    CHECK(reused == arena);

    for (int i = 0; i < 100000; i++) {
      ssc__fn__arena_alloc(reused, 64);
    }

    ssc__fn__arena_release(reused);
  }

  CHECK(ssc__fn__slab_mapped_bytes() == before);
`,
  ],
  [
    'a reused arena starts empty and owns its memory',
    `
  ssc__type__arena *arena = ssc__fn__arena_acquire();
  char *first = ssc__fn__arena_alloc(arena, 64);

  for (int i = 0; i < 100000; i++) {
    ssc__fn__arena_alloc(arena, 64);
  }

  ssc__fn__arena_release(arena);

  ssc__type__arena *reused = ssc__fn__arena_acquire();
  ssc__type__arena *other = ssc__fn__arena_acquire();

  CHECK(reused == arena);
  CHECK(other != arena);
  CHECK(ssc__fn__arena_alloc(reused, 64) == first);

  for (int i = 0; i < 100000; i++) {
    CHECK(ssc__fn__arena_of(ssc__fn__arena_alloc(reused, 64)) == reused);
    CHECK(ssc__fn__arena_of(ssc__fn__arena_alloc(other, 64)) == other);
  }
`,
  ],
])('%s', async (_, body) => {
  const { status, stderr } = await runC(body, prologue);

  expect(stderr).toBe('');
  expect(status).toBe(0);
});
