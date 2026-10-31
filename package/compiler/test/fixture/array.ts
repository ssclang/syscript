declare function exit(code: i32): void;

const numbers: i32[] = [i32(1), i32(2), i32(3)];
const words: string[] = ['a', 'b'];
const empty: f64[] = [];
const mixed: (i32 | string)[] = [i32(1), 'x'];
const nested: i32[][] = [[i32(1), i32(2)], [i32(3)]];

console.log(numbers, words, empty, mixed, nested);
console.log(numbers.length, numbers[u64(0)], numbers[u64(2)], numbers[u64(3)]);

numbers[u64(1)] = i32(20);
console.log(numbers);

const length: u64 = numbers.push(i32(4), i32(5));
console.log(length, numbers);

const popped: i32 | undefined = numbers.pop();
console.log(popped, numbers.length, empty.pop());

const shared: i32[] = numbers;
shared.push(i32(6));
console.log(numbers.length);

const index: u64 = u64(1);
console.log(words[index], `${numbers}`, 'w=' + words);

let total: i32 = i32(0);

for (let i: u64 = u64(0); i < numbers.length; i++) {
  total += numbers[i] as i32;
}

console.log(total);
exit(i32(0));
