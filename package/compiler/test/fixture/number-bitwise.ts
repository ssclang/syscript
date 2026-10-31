const fraction: f64 = 5.7;
const negative: f64 = -1;
const wide: f64 = 4294967299;

console.log(fraction | 0, negative >>> 0, (0 / 0) | 0, wide | 0, 1e21 | 0);
console.log(1 << 33, -8 >> 1, -8 >>> 28, ~5.5, 6 & 3, 6 ^ 3, 6 | 3);
