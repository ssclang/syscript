function fail(value: unknown): void {
  throw value;
}

function caught(value: unknown): unknown {
  try {
    fail(value);
  } catch (e) {
    return e;
  }

  return 'not thrown';
}

function rethrown(): string {
  try {
    try {
      throw 'inner';
    } catch (e) {
      throw `${e} again`;
    }
  } catch (e) {
    return `outer caught ${e}`;
  }
}

function prelude(): unknown {
  const numbers: i32[] = [i32(1)];

  try {
    numbers[u64(3)] = i32(2);
  } catch (e) {
    return e;
  }

  return 'not thrown';
}

function captured(): string {
  let read: () => unknown = () => 'none';

  try {
    throw 'kept';
  } catch (e) {
    read = () => e;
  }

  return `${read()}`;
}

let count: number = 0;

try {
  count = count + 1;
} catch {
  count = count + 100;
}

try {
  throw 1;
} catch {
  count = count + 10;
}

console.log(caught(42), caught('text'), caught({ a: i32(1) }), caught(undefined));
console.log(rethrown(), prelude(), captured(), count);
