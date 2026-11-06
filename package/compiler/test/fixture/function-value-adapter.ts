function show(value: number | string): string {
  return `[${value}]`;
}

function twice(value: number): number {
  return value * 2;
}

const wide: (value: number | string) => string = (value) => `<${value}>`;
const narrow: (value: number) => string = wide;
const fromDeclaration: (value: number) => string = show;
const ignoreResult: (value: number) => void = twice;
const fewer: (value: number, index: number) => number = (value) => value + 1;

console.log(narrow(1), fromDeclaration(2), fewer(3, 9));
ignoreResult(4);

const numbers = [1, 2, 3];
console.log(numbers.map(twice), numbers.map((n) => n + 1), numbers.map(narrow));
console.log(numbers.reduce((sum, n) => sum + n, 0), numbers.reduce((text, n) => text + n, ''));
numbers.forEach((n) => n * 2);

const maybe: number | undefined = numbers.find((n) => n > 1);
console.log(maybe, numbers.filter((n) => n !== 2), numbers.some((n) => n > 2), numbers.every((n) => n > 2));
