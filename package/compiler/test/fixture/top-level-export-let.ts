import { count, inc } from './top-level-export-let-lib.js';

declare function exit(code: i32): void;

inc();
inc();
inc();
exit(count);
