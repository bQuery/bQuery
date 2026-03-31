/**
 * Read-only signal wrappers.
 */

import type { Signal } from './core';

const READONLY_SIGNAL_BRAND = Symbol('bquery.readonlySignal');

/** @internal */
type BrandedReadonlySignal<T> = ReadonlySignal<T> & {
  readonly [READONLY_SIGNAL_BRAND]: true;
};

/**
 * A readonly wrapper around a signal that prevents writes.
 * Provides read-only access to a signal's value while maintaining reactivity.
 *
 * @template T - The type of the wrapped value
 */
export interface ReadonlySignal<T> {
  /** Gets the current value with dependency tracking. */
  readonly value: T;
  /** Gets the current value without dependency tracking. */
  peek(): T;
}

/**
 * Determines whether a value is a bQuery readonly signal wrapper.
 *
 * @internal
 */
export const isReadonlySignal = <T>(value: unknown): value is BrandedReadonlySignal<T> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    READONLY_SIGNAL_BRAND in value
  );
};

/**
 * Creates a read-only view of a signal.
 * Useful for exposing reactive state without allowing modifications.
 *
 * @template T - The type of the signal value
 * @param sig - The signal to wrap
 * @returns A readonly signal wrapper
 */
export const readonly = <T>(sig: Signal<T>): ReadonlySignal<T> =>
  Object.defineProperties(
    {},
    {
      value: {
        get(): T {
          return sig.value;
        },
        enumerable: true,
      },
      peek: {
        value(): T {
          return sig.peek();
        },
        enumerable: true,
      },
      [READONLY_SIGNAL_BRAND]: {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false,
      },
    }
  ) as BrandedReadonlySignal<T>;
