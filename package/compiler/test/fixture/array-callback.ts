declare function exit(code: i32): void;

const numbers: i32[] = [i32(1), i32(2), i32(3), i32(4)];
const words: string[] = ['a', 'bb', 'ccc'];
let visited: string = '';

numbers.forEach((value: i32, index: u64): void => {
  visited += `${index}:${value} `;
});

console.log(visited);
console.log(numbers.map((value: i32): i32 => value * i32(10)), words.map((word: string): u64 => word.length));
console.log(numbers.filter((value: i32): boolean => value % i32(2) === i32(0)), words.filter((word: string): boolean => word.length > u64(1)));
console.log(numbers.reduce((sum: i64, value: i32): i64 => sum + i64(value), i64(100)), words.reduce((text: string, word: string): string => text + word, '>'));
console.log(numbers.find((value: i32): boolean => value > i32(2)), numbers.find((value: i32): boolean => value > i32(9)), words.find((word: string): boolean => word === 'bb'));
console.log(numbers.some((value: i32): boolean => value > i32(3)), numbers.some((value: i32): boolean => value > i32(4)));
console.log(numbers.every((value: i32): boolean => value > i32(0)), numbers.every((value: i32): boolean => value > i32(1)));
console.log(numbers.indexOf(i32(3)), numbers.indexOf(i32(9)), words.indexOf('ccc'));
exit(i32(0));
