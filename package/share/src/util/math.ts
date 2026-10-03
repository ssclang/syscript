import { MaybePromise } from '~/type.js';

export class CustomMath {
  static sum(numbers: number[]) {
    let sum = 0;

    for (const number of numbers) {
      sum += number;
    }

    return sum;
  }

  static async sumAsync(numbers: MaybePromise<number>[]) {
    let sum = 0;

    for (const number of numbers) {
      sum += number instanceof Promise ? await number : number;
    }

    return sum;
  }
}
