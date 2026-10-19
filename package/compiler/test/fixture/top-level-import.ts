import { count, increase } from './top-level-counter.js';

declare function exit(code: i32): void;

increase(3);
increase(4);
exit(count);
