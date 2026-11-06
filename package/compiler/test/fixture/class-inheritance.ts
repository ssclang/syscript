class Animal {
  name: string;
  sound: string = 'generic';
  log: string = '';

  constructor(name: string) {
    this.name = name;
    this.log = this.log + this.kind();
  }

  kind(): string {
    return 'animal';
  }

  speak(): string {
    return `${this.name} says ${this.sound}`;
  }

  describe(): string {
    return `${this.kind()}:${this.name}`;
  }
}

class Dog extends Animal {
  tricks: number = 2;

  constructor(name: string) {
    super(name);
    this.sound = 'woof';
  }

  override kind(): string {
    return 'dog';
  }

  override speak(): string {
    return `${super.speak()}!`;
  }

  shout(): string {
    const loud = () => super.speak();
    return loud();
  }
}

class Puppy extends Dog {
  override kind(): string {
    return `small ${super.kind()}`;
  }
}

const animals: Animal[] = [new Animal('cat'), new Dog('rex'), new Puppy('bit')];

animals.forEach((a) => {
  console.log(a.speak(), a.describe(), a.log, a instanceof Dog, a instanceof Puppy);
});

const dog = new Dog('max');
const maybe: Animal | undefined = dog;
console.log(dog, dog.tricks, dog.shout(), maybe instanceof Dog);
