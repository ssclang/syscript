import { count, increase } from './top-level-counter.js';

declare function exit(code: i32): void;

increase(i32(3));
increase(i32(4));
exit(count);
