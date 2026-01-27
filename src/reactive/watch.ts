/**
 * Value watching helpers.
 */

import type { Computed } from './computed';
import type { Signal } from './core';
import type { CleanupFn } from './internals';

import { effect } from './effect';

/**
 * Options for the watch function.
 */
export interface WatchOptions<T> {
  /** If true, the callback is invoked immediately with the current value. */
  immediate?: boolean;
  /** Custom equality function. Defaults to Object.is. */
  equals?: (a: T, b: T | undefined) => boolean;
}

/**
 * Watches a signal or computed value and calls a callback with old and new values.
 * Unlike effect, watch provides access to the previous value.
 * The callback is only invoked when the value actually changes (compared via Object.is or custom equals).
 *
 * @template T - The type of the watched value
 * @param source - The signal or computed to watch
 * @param callback - Function called with (newValue, oldValue) on changes
 * @param options - Watch options
 * @returns A cleanup function to stop watching
 *
 * @example
 * ```ts
 * const count = signal(0);
 * watch(count, (newVal, oldVal) => {
 *   console.log(`Changed from ${oldVal} to ${newVal}`);
 * });
 *
 * // With custom equality for objects
 * const user = signal({ id: 1, name: 'Alice' });
 * watch(user, (newVal, oldVal) => { ... }, {
 *   equals: (a, b) => a?.id === b?.id
 * });
 * ```
 */
export const watch = <T>(
  source: Signal<T> | Computed<T>,
  callback: (newValue: T, oldValue: T | undefined) => void,
  options: WatchOptions<T> = {}
): CleanupFn => {
  const { immediate = false, equals = Object.is } = options;
  let oldValue: T | undefined;
  let isFirst = true;

  return effect(() => {
    const newValue = source.value;

    if (isFirst) {
      isFirst = false;
      oldValue = newValue;
      if (immediate) {
        callback(newValue, undefined);
      }
      return;
    }

    // Only call callback if value actually changed
    if (!equals(newValue, oldValue)) {
      callback(newValue, oldValue);
      oldValue = newValue;
    }
  });
};
