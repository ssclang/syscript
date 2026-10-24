declare function exit(code: i32): void;

let trace: string = '';
let value: i32 = 1;

function mark(name: string, result: i32): i32 {
  trace += name;
  return result;
}

function markIndex(name: string, result: u64): u64 {
  trace += name;
  return result;
}

function markFloat(name: string, result: f64): f64 {
  trace += name;
  return result;
}

function markText(name: string, result: string): string {
  trace += name;
  return result;
}

function bump(): i32 {
  trace += 'b';
  value = 10;
  return 1;
}

function take(a: i32, b: i32, c: i32): i32 {
  return a * 100 + b * 10 + c;
}

function check(label: string): void {
  console.log(label, trace);
  trace = '';
}

take(mark('a', 1), mark('b', 2), mark('c', 3));
check('call');

take(mark('a', mark('b', 1)), mark('c', 2), take(mark('d', 1), mark('e', 2), mark('f', 3)));
check('nested call');

mark('a', 1) + mark('b', 2);
check('add');

mark('a', 1) * mark('b', 2) - mark('c', 3) / mark('d', 1) % mark('e', 4);
check('arithmetic');

mark('a', 7) & mark('b', 3) | mark('c', 8) ^ mark('d', 1);
check('bitwise');

mark('a', 1) << mark('b', 2) >> mark('c', 1);
check('shift');

markFloat('a', 0.5) + markFloat('b', 1.5) * markFloat('c', 2);
check('float');

mark('a', 1) < mark('b', 2);
check('compare');

mark('a', 1) === mark('b', 2);
check('equality');

markText('a', 'x') + markText('b', 'y') + markText('c', 'z');
check('concat');

`${markText('a', 'x')}-${mark('b', 1)}-${markFloat('c', 2)}`;
check('template');

console.log(mark('a', 1), mark('b', 2), mark('c', 3));
check('console.log');

const list: i32[] = [mark('a', 1), mark('b', 2), mark('c', 3)];
check('array literal');

list.push(mark('a', 4), mark('b', 5));
check('push');

list[markIndex('a', 0)] = mark('b', 9);
check('element assignment');

list[markIndex('a', 0)];
check('element access');

value = 1;
value += bump();
console.log('compound assignment', value);
check('compound assignment');

value = 1;
console.log('read before call', take(value, bump(), value));
check('read before call');

exit(0);
