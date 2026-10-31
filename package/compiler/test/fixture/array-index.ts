const a: i32[] = [i32(10), i32(20)];
const unsigned: u64 = u64(0);
const float: f64 = 1;

console.log(a[1], a[1.5], a[-1], a[2], a[0 / 0]);
console.log(a[unsigned], a[float]);
