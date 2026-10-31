import { libValue } from './tdz-cycle-lib.js';

declare function exit(code: i32): void;

export function readValue(): i32 {
  return value;
}

export const value: i32 = i32(7);
exit(libValue);
