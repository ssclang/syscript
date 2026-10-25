declare function exit(code: i32): void;

interface Point {
  y: i32;
  x: i32;
}

interface Pair {
  x: i32;
  y: i32;
}

interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
}

type Cat = Animal & { lives: i32 };

type Options = { size: i32; label?: string };

function sum(point: Point): i32 {
  return point.x + point.y;
}

function rename(animal: Animal, name: string): void {
  animal.name = name;
}

function describe(animal: Animal): string {
  return animal.name;
}

const point: Point = { y: 2, x: 1 };
const pair: Pair = point;
const x: i32 = 10;
const shorthand: Point = { x, y: 20 };
const dog: Dog = { name: 'rex', breed: 'pug' };
const cat: Cat = { lives: 9, name: 'tom' };
const options: Options = { size: 3 };
const nested = { point, tags: ['a'] };

console.log(point, pair, shorthand, options);
console.log(sum(point), sum(pair), point === pair);
point.x = 5;
console.log(pair.x);
rename(dog, 'max');
console.log(describe(dog), describe(cat), dog.name, dog);
console.log(options.label, typeof point, nested);
exit(0);
