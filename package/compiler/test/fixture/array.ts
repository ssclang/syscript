declare function exit(code: i32): void;

const numbers: i32[] = [1, 2, 3];
const words: string[] = ['a', 'b'];
const empty: f64[] = [];
const mixed: (i32 | string)[] = [1, 'x'];
const nested: i32[][] = [[1, 2], [3]];

console.log(numbers, words, empty, mixed, nested);
console.log(numbers.length, numbers[0], numbers[2], numbers[3]);

numbers[1] = 20;
console.log(numbers);

const length: u64 = numbers.push(4, 5);
console.log(length, numbers);

const popped: i32 | undefined = numbers.pop();
console.log(popped, numbers.length, empty.pop());

const shared: i32[] = numbers;
shared.push(6);
console.log(numbers.length);

const index: u64 = 1;
console.log(words[index], `${numbers}`, 'w=' + words);

let total: i32 = 0;

for (let i: u64 = 0; i < numbers.length; i++) {
  total += numbers[i] as i32;
}

console.log(total);
exit(0);
