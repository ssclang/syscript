class Counter {
  count: number = 0;
  label: string;
  readonly step: i32;

  constructor(label: string, step: i32) {
    this.label = label;
    this.step = step;
  }

  increment(): number {
    this.count = this.count + 1;
    return this.count;
  }

  twice(): number {
    this.increment();
    return this.increment();
  }

  describe(): string {
    return `${this.label}=${this.count}`;
  }

  adder(base: number): (value: number) => number {
    return (value: number) => value + base + this.count;
  }
}

class Empty {}

class Order {
  log: string = 'a';
  extra: string = this.log + 'b';

  constructor() {
    this.log = this.log + 'c';
  }
}

class Link {
  value: number;
  next: Link | undefined = undefined;

  constructor(value: number) {
    this.value = value;
  }
}

const counter = new Counter('c', i32(1));
console.log(counter.increment(), counter.twice(), counter.describe());

const add = counter.adder(100);
counter.increment();
console.log(add(10));
console.log(counter);
console.log(new Empty(), new Order());

const head = new Link(1);
head.next = new Link(2);
const second = head.next;

if (second) {
  console.log(second.value, head);
}
