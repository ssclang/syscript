import { expect, test } from 'vitest';
import { emitLlvmIr } from '~/llvm/emitter.js';
import { parse } from '~/parser/parser.js';

test('empty source file', () => {
  expect(emitLlvmIr(parse(''))).toMatchInlineSnapshot(`
    "define i32 @main() {
    block.0:
      ret i32 0
    }
    "
  `);
});

test('val i64', () => {
  const source = `
val a = 7
std.out(a)
`.trim();

  expect(emitLlvmIr(parse(source))).toMatchInlineSnapshot(`
    "@.i64.format = private unnamed_addr constant [6 x i8] c"%lld\\0A\\00"

    declare i32 @printf(ptr, ...)

    define i32 @main() {
    block.0:
      %a.address = alloca i64
      store i64 7, ptr %a.address
      %t0 = load i64, ptr %a.address
      %t1 = call i32 (ptr, ...) @printf(ptr @.i64.format, i64 %t0)
      ret i32 0
    }
    "
  `);
});

test('var i64', () => {
  const source = `
var count = 1
count = count + 2
std.out(count * 3)
`.trim();

  expect(emitLlvmIr(parse(source))).toMatchInlineSnapshot(`
    "@.i64.format = private unnamed_addr constant [6 x i8] c"%lld\\0A\\00"

    declare i32 @printf(ptr, ...)

    define i32 @main() {
    block.0:
      %count.address = alloca i64
      store i64 1, ptr %count.address
      %t0 = load i64, ptr %count.address
      %t1 = add i64 %t0, 2
      store i64 %t1, ptr %count.address
      %t2 = load i64, ptr %count.address
      %t3 = mul i64 %t2, 3
      %t4 = call i32 (ptr, ...) @printf(ptr @.i64.format, i64 %t3)
      ret i32 0
    }
    "
  `);
});
