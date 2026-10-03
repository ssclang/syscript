// inferred return types that tsc widens to `number`, `expect` is the type ssc should infer at the call site

declare const a: i32;
declare const b: i32;
declare const l: i64;

// 1. binary arithmetic
function retAdd(x: i32, y: i32) {
  return x + y;
}

// 2. bitwise
function retAnd(x: i32, y: i32) {
  return x & y;
}

// 3. unary
function retNeg(x: i32) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-unary-minus
  return -x;
}

// 4. increment
function retInc(x: i32) {
  // eslint-disable-next-line no-useless-assignment
  return x++;
}

// 5. compound assignment
function retAddAssign(x: i32, y: i32) {
  // eslint-disable-next-line no-useless-assignment
  return (x += y);
}

// 6. local initialized by arithmetic
function retLocal(x: i32, y: i32) {
  const sum = x + y;
  return sum;
}

// 7. literal
function retLiteral() {
  return 0;
}

// 8. generic with arithmetic
function retGenericAdd<T extends number>(x: T, y: T) {
  return x + y;
}

// 9. multiple returns with different types
function retMixed(c: boolean, x: i32, y: i64) {
  if (c) {
    return x + 1;
  }
  return y;
}

// 10. conditional with different types
function retCond(c: boolean, x: i32, y: i64) {
  return c ? x + 1 : y;
}

// 11. call of a widened function
function retCall(x: i32, y: i32) {
  return retAdd(x, y);
}

export const r1 = retAdd(a, b); // expect: i32
export const r2 = retAnd(a, b); // expect: i32
export const r3 = retNeg(a); // expect: i32
export const r4 = retInc(a); // expect: i32
export const r5 = retAddAssign(a, b); // expect: i32
export const r6 = retLocal(a, b); // expect: i32
export const r7 = retLiteral(); // expect: ssc literal rule
export const r8 = retGenericAdd(a, b); // expect: i32
export const r9 = retMixed(true, a, l); // expect: ssc rule (error or i64)
export const r10 = retCond(true, a, l); // expect: ssc rule (error or i64)
export const r11 = retCall(a, b); // expect: i32
