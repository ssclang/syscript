import { abs, add } from './import-function-lib.js';
import { exit } from './libc.js';

exit(add(abs(3), 4));
