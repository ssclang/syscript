// ssc:include:<time.h>
// ssc:include:<stdlib.h>

/** `clock_t`는 64비트 Linux에서 `long`이다. */
export declare function clock(): i64;

export declare function exit(status: i32): void;
