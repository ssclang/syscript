class Counter {
  count: number = 0;

  increment(): number {
    this.count = this.count + 1;
    return this.count;
  }
}

class Loud extends Counter {
  override increment(): number {
    return super.increment() * 10;
  }
}

const plain = { count: 10, increment: () => 100 };
const asCounter: Counter = plain;
const asShape: { increment(): number } = new Counter();
const counters: Counter[] = [new Counter(), new Loud(), plain];

console.log(asCounter.increment(), asShape.increment(), asShape.increment());
console.log(counters.map((c) => c.increment()));
