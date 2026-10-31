declare function exit(code: i32): void;

let trace: string = '';
let value: i32 = i32(1);

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
  value = i32(10);
  return i32(1);
}

function take(a: i32, b: i32, c: i32): i32 {
  return a * i32(100) + b * i32(10) + c;
}

function check(label: string): void {
  console.log(label, trace);
  trace = '';
}

take(mark('a', i32(1)), mark('b', i32(2)), mark('c', i32(3)));
check('call');

take(mark('a', mark('b', i32(1))), mark('c', i32(2)), take(mark('d', i32(1)), mark('e', i32(2)), mark('f', i32(3))));
check('nested call');

mark('a', i32(1)) + mark('b', i32(2));
check('add');

mark('a', i32(1)) * mark('b', i32(2)) - mark('c', i32(3)) / mark('d', i32(1)) % mark('e', i32(4));
check('arithmetic');

mark('a', i32(7)) & mark('b', i32(3)) | mark('c', i32(8)) ^ mark('d', i32(1));
check('bitwise');

mark('a', i32(1)) << mark('b', i32(2)) >> mark('c', i32(1));
check('shift');

markFloat('a', 0.5) + markFloat('b', 1.5) * markFloat('c', 2);
check('float');

mark('a', i32(1)) < mark('b', i32(2));
check('compare');

mark('a', i32(1)) === mark('b', i32(2));
check('equality');

markText('a', 'x') + markText('b', 'y') + markText('c', 'z');
check('concat');

`${markText('a', 'x')}-${mark('b', i32(1))}-${markFloat('c', 2)}`;
check('template');

console.log(mark('a', i32(1)), mark('b', i32(2)), mark('c', i32(3)));
check('console.log');

const list: i32[] = [mark('a', i32(1)), mark('b', i32(2)), mark('c', i32(3))];
check('array literal');

list.push(mark('a', i32(4)), mark('b', i32(5)));
check('push');

list[markIndex('a', u64(0))] = mark('b', i32(9));
check('element assignment');

list[markIndex('a', u64(0))];
check('element access');

value = i32(1);
value += bump();
console.log('compound assignment', value);
check('compound assignment');

value = i32(1);
console.log('read before call', take(value, bump(), value));
check('read before call');

exit(i32(0));
