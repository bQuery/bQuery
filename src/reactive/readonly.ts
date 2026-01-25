/**
 * Read-only signal wrappers.
 */

import type { Signal } from './core';

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
 * Creates a read-only view of a signal.
 * Useful for exposing reactive state without allowing modifications.
 *
 * @template T - The type of the signal value
 * @param sig - The signal to wrap
 * @returns A readonly signal wrapper
 */
export const readonly = <T>(sig: Signal<T>): ReadonlySignal<T> => ({
  get value(): T {
    return sig.value;
  },
  peek(): T {
    return sig.peek();
  },
});
