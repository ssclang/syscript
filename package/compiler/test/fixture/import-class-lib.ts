export class Box {
  value: number;

  constructor(value: number) {
    this.value = value;
  }

  double(): number {
    return this.value * 2;
  }
}
