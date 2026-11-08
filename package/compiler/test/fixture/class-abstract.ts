abstract class Shape {
  abstract name: string;
  scale: number = 1;

  abstract area(): number;

  describe(): string {
    return `${this.name}:${this.area() * this.scale}`;
  }
}

class Square extends Shape {
  name: string = 'square';

  constructor(public side: number) {
    super();
  }

  area(): number {
    return this.side * this.side;
  }
}

class Circle extends Shape {
  name: string = 'circle';

  area(): number {
    return 3;
  }
}

const shapes: Shape[] = [new Square(2), new Circle()];

shapes.forEach((s) => {
  console.log(s.describe(), s.area(), s);
});
