declare function exit(code: i32): void;

const integer: i32 = i32(-42);
const big: u64 = u64('18446744073709551615');
const sum: f64 = 0.1 + 0.2;
const single: f32 = f32(0.1);
const large: f64 = 1e21;
const zero: f64 = 0;
const nan: f64 = zero / zero;
const infinity: f64 = 1 / zero;
const negativeZero: f64 = -zero;
const emoji: char = char(0x1f44d);
let value: i32 | string | undefined = i32(7);

console.log('integer:', integer, big);
console.log(sum, single, large, 1);
console.log(nan, infinity, -infinity, negativeZero);
console.log(true, null, undefined, emoji);
console.log(value);
value = 'text';
console.log(value);
value = undefined;
console.log(value);
console.log('n=' + integer + ', f=' + single + ', ok=' + true + ', c=' + emoji);
console.log();
console.error('error', 1);
exit(i32(0));
