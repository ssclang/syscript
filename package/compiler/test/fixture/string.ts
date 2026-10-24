declare function exit(code: i32): void;

function length(s: string): u64 {
  return s.length;
}

function equals(a: string, b: string): boolean {
  return a === b;
}

function differs(a: string, b: string): boolean {
  return a !== b;
}

function less(a: string, b: string): boolean {
  return a < b;
}

function lessOrEqual(a: string, b: string): boolean {
  return a <= b;
}

function greater(a: string, b: string): boolean {
  return a > b;
}

function greaterOrEqual(a: string, b: string): boolean {
  return a >= b;
}

function orEmpty(s: string | undefined): string {
  if (s === undefined) {
    return '';
  }

  return s;
}

function kind(v: string | i32): i32 {
  if (typeof v === 'string' && v.length === 2) {
    return 1;
  }

  return 2;
}

function join(a: string, b: string): string {
  return a + b;
}

function withChar(a: string, c: char): string {
  return a + c;
}

function append(a: string): string {
  let s: string = a;
  s += '!';

  return s;
}

function truthy(s: string): i32 {
  if (s) {
    return 1;
  }

  return 0;
}

const top: string = 'abc';
const topLength: u64 = top.length;
let result: i32 = 0;

if (length('hello') === 5 && length('한글') === 6 && length('👍') === 4 && length('') === 0) {
  result += 1;
}

if (topLength === 3) {
  result += 2;
}

if (equals('abc', 'abc') && equals('', '') && !equals('abc', 'abd') && !equals('ab', 'abc') && !equals('a\0b', 'a\0c') && differs('한', '글') && !differs('👍', '👍')) {
  result += 4;
}

if (less('a', 'b') && less('ab', 'abc') && less('', 'a') && less('B', 'a') && !less('a', 'a') && lessOrEqual('a', 'a') && greater('한', 'z') && greaterOrEqual('b', 'a') && !greaterOrEqual('a', 'b') && less('￿', '😀')) {
  result += 8;
}

if (orEmpty('hi') === 'hi' && orEmpty(undefined) === '' && kind('ab') === 1 && kind(7) === 2) {
  result += 16;
}

if (join('ab', 'cd') === 'abcd' && withChar('a', char(0x1f44d)) === 'a👍' && append('hi') === 'hi!') {
  result += 32;
}

if (truthy('x') === 1 && truthy('') === 0) {
  result += 64;
}

exit(result);
