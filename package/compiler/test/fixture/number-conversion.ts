const maxI32InI64: i64 = i64(2147483647);
const minI32InI64: i64 = i64(-2147483648);
const positiveI32: i32 = i32(7);
const negativeI32: i32 = i32(-5);
const maxI64InU64: u64 = u64('9223372036854775807');

const integerF64: f64 = 3;
const minI32F64: f64 = -2147483648;
const negativeZero: f64 = -0;
const largeF64: f64 = 18446744073709549568;

const maxSafeI64: i64 = i64('9007199254740992');
const maxSafeI32InF32: i32 = i32(16777216);
const half: f64 = 0.5;
const notANumber: f64 = 0 / 0;
const infinity: f64 = 1 / 0;

console.log(i32(maxI32InI64), i32(minI32InI64), u64(positiveI32), i8(negativeI32), i64(maxI64InU64));
console.log(i32(integerF64), i32(minI32F64), u8(negativeZero), u64(largeF64));
console.log(f64(maxSafeI64), f32(maxSafeI32InF32), f32(half), f32(notANumber), f32(infinity));
