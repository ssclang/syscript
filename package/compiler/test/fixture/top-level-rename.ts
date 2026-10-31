import { count as total, increase } from './top-level-counter.js';

declare function exit(code: i32): void;

increase(i32(5));
exit(total);
