class Point {
  x: number = 1;
  label: string = 'p';
  next: Point | undefined;

  constructor(scale: number) {
    if (scale > 1) {
      return;
    }
  }

  area(height: number): number {
    return height * 2;
  }
}

export class Empty {}
