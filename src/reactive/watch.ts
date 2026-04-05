/**
 * Value watching helpers.
 */

import type { Computed } from './computed';
import type { Signal } from './core';
import type { CleanupFn } from './internals';

import { debounce, throttle } from '../core/utils/function';
import { effect } from './effect';
import { getCurrentScope, onScopeDispose } from './scope';

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

/**
 * Watches a signal or computed value and debounces callback delivery.
 * Rapid changes are collapsed into a single callback using the latest value
 * and the first old value observed within the debounce window.
 *
 * @template T - The type of the watched value
 * @param source - The signal or computed to watch
 * @param callback - Function called with the debounced (newValue, oldValue)
 * @param delayMs - Debounce delay in milliseconds
 * @param options - Watch options
 * @returns A cleanup function to stop watching and cancel pending callbacks
 *
 * @example
 * ```ts
 * const query = signal('');
 * const stop = watchDebounce(query, (newQuery) => {
 *   console.log('Search for', newQuery);
 * }, 250);
 *
 * query.value = 'b';
 * query.value = 'bq';
 * query.value = 'bqu'; // Only this value is delivered after 250ms
 *
 * stop();
 * ```
 */
export const watchDebounce = <T>(
  source: Signal<T> | Computed<T>,
  callback: (newValue: T, oldValue: T | undefined) => void,
  delayMs: number,
  options: WatchOptions<T> = {}
): CleanupFn => {
  const { immediate = false, equals = Object.is } = options;
  const normalizedDelayMs = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0;
  let hasPending = false;
  let pendingNewValue!: T;
  let pendingOldValue: T | undefined;
  const cancelPending = (): void => {
    notify.cancel();
    hasPending = false;
    pendingOldValue = undefined;
  };

  const notify = debounce(() => {
    if (!hasPending) {
      return;
    }

    try {
      callback(pendingNewValue, pendingOldValue);
    } catch (error) {
      console.error('bQuery reactive: Error in watchDebounce callback', error);
    }
    hasPending = false;
    pendingOldValue = undefined;
  }, normalizedDelayMs);

  if (immediate) {
    callback(source.peek(), undefined);
  }

  const cleanup = watch(
    source,
    (newValue, oldValue) => {
      if (!hasPending) {
        pendingOldValue = oldValue;
      }

      pendingNewValue = newValue;
      hasPending = true;
      notify();
    },
    { equals }
  );

  if (getCurrentScope()) {
    onScopeDispose(cancelPending);
  }

  return () => {
    cleanup();
    cancelPending();
  };
};

/**
 * Watches a signal or computed value and throttles callback delivery.
 * Changes are delivered at most once per interval.
 *
 * @template T - The type of the watched value
 * @param source - The signal or computed to watch
 * @param callback - Function called with throttled (newValue, oldValue) updates
 * @param intervalMs - Minimum interval between callback runs in milliseconds
 * @param options - Watch options
 * @returns A cleanup function to stop watching and reset the throttle window
 *
 * @example
 * ```ts
 * const scrollY = signal(0);
 * const stop = watchThrottle(scrollY, (nextY) => {
 *   console.log('Scroll position', nextY);
 * }, 100);
 *
 * stop();
 * ```
 */
export const watchThrottle = <T>(
  source: Signal<T> | Computed<T>,
  callback: (newValue: T, oldValue: T | undefined) => void,
  intervalMs: number,
  options: WatchOptions<T> = {}
): CleanupFn => {
  const { immediate = false, equals = Object.is } = options;
  const normalizedIntervalMs = Number.isFinite(intervalMs) ? Math.max(0, intervalMs) : 0;
  const notify = throttle(
    (newValue: T, oldValue: T | undefined) => {
      callback(newValue, oldValue);
    },
    normalizedIntervalMs
  );

  if (immediate) {
    notify(source.peek(), undefined);
  }

  const cleanup = watch(source, (newValue, oldValue) => {
    notify(newValue, oldValue);
  }, { equals });

  return () => {
    cleanup();
    notify.cancel();
  };
};
