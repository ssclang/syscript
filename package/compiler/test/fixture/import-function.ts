import { abs, add } from './import-function-lib.js';
import { exit } from './libc.js';

exit(add(abs(i32(3)), i32(4)));
