/**
 * Value watching helpers.
 */

import type { Computed } from './computed';
import type { Signal } from './core';
import { effect } from './effect';
import { CleanupFn } from './internals';

/**
 * Watches a signal or computed value and calls a callback with old and new values.
 * Unlike effect, watch provides access to the previous value.
 *
 * @template T - The type of the watched value
 * @param source - The signal or computed to watch
 * @param callback - Function called with (newValue, oldValue) on changes
 * @param options - Watch options
 * @returns A cleanup function to stop watching
 */
export const watch = <T>(
  source: Signal<T> | Computed<T>,
  callback: (newValue: T, oldValue: T | undefined) => void,
  options: { immediate?: boolean } = {}
): CleanupFn => {
  let oldValue: T | undefined;
  let isFirst = true;

  return effect(() => {
    const newValue = source.value;

    if (isFirst) {
      isFirst = false;
      oldValue = newValue;
      if (options.immediate) {
        callback(newValue, undefined);
      }
      return;
    }

    callback(newValue, oldValue);
    oldValue = newValue;
  });
};
