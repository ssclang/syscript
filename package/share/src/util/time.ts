import { MaybePromise } from '~/type.js';
import { assert } from '~/util/assert.js';

type MeasureResult<T> = {
  start: number;
  end: number;
  duration: number;
  result: T;
};

export class Time {
  static ONE_SECOND_IN_MILLISECONDS = 1_000;
  static ONE_MINUTE_IN_MILLISECONDS = Time.ONE_SECOND_IN_MILLISECONDS * 60;

  static ONE_MINUTE_IN_SECONDS = 60;
  static ONE_HOUR_IN_SECONDS = Time.ONE_MINUTE_IN_SECONDS * 60;
  static ONE_DAY_IN_SECONDS = Time.ONE_HOUR_IN_SECONDS * 24;

  static async wait(duration = 1_000) {
    assert(duration >= 0);
    await new Promise((resolve) => setTimeout(resolve, duration));
  }

  static async waitRandom(min: number, max: number) {
    assert(min >= 0);
    assert(max >= 0);
    assert(min <= max);

    const duration = Math.trunc(Math.random() * (max - min + 1) + min);

    await Time.wait(duration);
  }

  static measure<T>(callback: () => Promise<T>): Promise<MeasureResult<T>>;

  static measure<T>(callback: () => T): MeasureResult<T>;

  static measure<T>(callback: () => MaybePromise<T>): MaybePromise<MeasureResult<T>> {
    const getResult = (start: number, result: T) => {
      const end = performance.now();
      const duration = end - start;

      return { start, end, duration, result };
    };

    const start = performance.now();
    const result = callback();

    return result instanceof Promise ?
        result.then((r) => getResult(start, r))
      : getResult(start, result);
  }

  static displayMeasureResult(result: MeasureResult<unknown>, unit: 'ms' | 's') {
    if (unit === 's') {
      return `${(result.duration / 1_000).toFixed(2)}s`;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (unit === 'ms') {
      return `${result.duration.toFixed(2)}ms`;
    }

    throw new Error(unit);
  }

  static async withTimeout<T>(
    callback: () => MaybePromise<T>,
    timeoutInMillis: number,
    resolveValueOnTimeout?: T,
  ): Promise<T> {
    const { promise, reject, resolve } = Promise.withResolvers<T>();

    const timer = setTimeout(() => {
      if (resolveValueOnTimeout !== undefined) {
        resolve(resolveValueOnTimeout);
      } else {
        reject(new Error(`timeout: ${timeoutInMillis} ms`));
      }
    }, timeoutInMillis);

    void Promise.resolve()
      .then(callback)
      .finally(() => clearTimeout(timer))
      .then(resolve)
      .catch(reject);

    return promise;
  }
}
