import { AbstractOrClassType } from '~/type.js';

export function assert(condition: unknown, message?: string): asserts condition {
  if (condition) {
    return;
  }

  const error = new Error();
  const stackTraces = error.stack?.split('\n') || [];
  const idx = stackTraces.findIndex((l) => l.startsWith('    at processTicksAndRejections'));
  const sliceEnd = idx === -1 ? undefined : idx;
  const stacks = stackTraces.slice(1, sliceEnd).join('\n');

  if (message) {
    error.message = `assert: ${JSON.stringify(condition)} | ${message}\n${stacks}`;
  } else {
    error.message = `assert: ${JSON.stringify(condition)}\n${stacks}`;
  }

  throw error;
}

export function assertArrayIsDistinct(array: readonly unknown[]) {
  assert(array.length === new Set(array).size);
}

export function is<T>(value: unknown, match: AbstractOrClassType<T>): value is T {
  return value instanceof match;
}

export function isError(value: unknown): value is Error;
export function isError<E extends Error>(value: unknown, match: AbstractOrClassType<E>): value is E;
export function isError(value: unknown, match: AbstractOrClassType<Error> = Error) {
  return value instanceof match;
}
