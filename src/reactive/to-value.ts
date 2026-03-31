/**
 * Utility to unwrap reactive or plain values.
 */

import { Computed } from './computed';
import { Signal } from './core';
import type { ReadonlySignal } from './readonly';

/**
 * A value that may be a raw value, a Signal, a ReadonlySignal, or a Computed.
 *
 * Useful for APIs that accept both reactive and plain inputs.
 *
 * @template T - The underlying value type
 *
 * @example
 * ```ts
 * function useTitle(title: MaybeSignal<string>) {
 *   document.title = toValue(title);
 * }
 *
 * useTitle('Hello');               // plain string
 * useTitle(signal('Hello'));       // reactive signal
 * useTitle(computed(() => 'Hi')); // computed value
 * ```
 */
export type MaybeSignal<T> = T | Signal<T> | ReadonlySignal<T> | Computed<T>;

/**
 * Extracts the current value from a Signal, ReadonlySignal, Computed, or returns the
 * raw value as-is. This eliminates repetitive
 * `isSignal(x) ? x.value : x` patterns throughout user code.
 *
 * Reading a Signal or Computed via `toValue()` uses `.value`, so the
 * read **does** participate in reactive tracking when called inside
 * an effect or computed.
 *
 * @template T - The underlying value type
 * @param source - A plain value, Signal, ReadonlySignal, or Computed
 * @returns The unwrapped value
 *
 * @example
 * ```ts
 * import { signal, computed, toValue } from '@bquery/bquery/reactive';
 *
 * const count = signal(5);
 * const doubled = computed(() => count.value * 2);
 *
 * toValue(42);      // 42
 * toValue(count);   // 5
 * toValue(doubled); // 10
 * toValue(null);    // null
 * ```
 */
export const toValue = <T>(source: MaybeSignal<T>): T => {
  if (source instanceof Signal || source instanceof Computed || isReadonlySignalLike(source)) {
    return source.value;
  }
  return source;
};

/**
 * Determines whether a value matches the public ReadonlySignal shape.
 * @internal
 */
const isReadonlySignalLike = <T>(value: unknown): value is ReadonlySignal<T> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    'peek' in value &&
    typeof (value as { peek?: unknown }).peek === 'function'
  );
};
