/**
 * Store watch helpers.
 */

import type { Store } from './types';
import { deepEqual } from './utils';

export type WatchStoreOptions<T> = {
  /** Call the callback immediately with the current value. */
  immediate?: boolean;
  /** Use deep comparison when determining changes. */
  deep?: boolean;
  /** Custom equality check for selected values. */
  equals?: (a: T, b: T) => boolean;
};

/**
 * Watch a selected slice of store state.
 *
 * @param store - The store instance
 * @param selector - Function to select the watched value
 * @param callback - Called when the selected value changes
 * @param options - Watch options
 * @returns Unsubscribe function
 */
export const watchStore = <
  S extends Record<string, unknown>,
  G extends Record<string, unknown>,
  A extends Record<string, (...args: unknown[]) => unknown>,
  T,
>(
  store: Store<S, G, A>,
  selector: (state: S) => T,
  callback: (value: T, previous: T | undefined) => void,
  options: WatchStoreOptions<T> = {}
): (() => void) => {
  const equals = options.equals ?? (options.deep ? deepEqual : Object.is);
  let previous = selector(store.$state);

  if (options.immediate) {
    callback(previous, undefined);
  }

  return store.$subscribe((state) => {
    const current = selector(state);
    if (!equals(current, previous)) {
      const prev = previous;
      previous = current;
      callback(current, prev);
    }
  });
};
