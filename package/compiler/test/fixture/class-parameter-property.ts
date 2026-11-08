class Point {
  label: string = 'p';

  constructor(
    public x: number,
    readonly y: number,
  ) {
    this.label = `${this.label}${x + y}`;
  }

  sum(): number {
    return this.x + this.y;
  }
}

class Point3 extends Point {
  depth: number = 0;

  constructor(
    x: number,
    public z: number,
  ) {
    super(x, x);
    this.depth = this.z * 10;
  }
}

class Capture {
  constructor(public value: number) {
    const read = () => value;
    value = value + 1;
    console.log(read(), this.value);
  }
}

console.log(new Point(1, 2), new Point(3, 4).sum());
console.log(new Point3(5, 6));
console.log(new Capture(7));
