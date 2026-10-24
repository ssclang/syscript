declare function exit(code: i32): void;

const numbers: i32[] = [1];
const same: i32[] = numbers;
const other: i32[] = [1];
const empty: i32[] = [];
const text: string = 'a';
const blank: string = '';

if (numbers) {
  console.log('numbers');
}

if (empty) {
  console.log('empty');
}

if (text) {
  console.log('text');
}

if (!blank) {
  console.log('blank');
}

console.log(numbers === same, numbers === other, numbers !== other, text === 'a', text !== blank);
exit(0);
