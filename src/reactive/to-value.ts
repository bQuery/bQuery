/**
 * Utility to unwrap reactive or plain values.
 */

import { Computed } from './computed';
import { Signal } from './core';
import { readonly, isReadonlySignal } from './readonly';

/**
 * A value that may be a raw value, a Signal, a `readonly()` wrapper, or a Computed.
 *
 * Useful for APIs that accept both reactive and plain inputs.
 *
 * Readonly wrappers are limited to the values returned by {@link readonly}. This keeps
 * the type aligned with runtime behavior, where arbitrary structural `{ value, peek }`
 * objects are intentionally returned unchanged.
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
export type MaybeSignal<T> = T | Signal<T> | ReturnType<typeof readonly<T>> | Computed<T>;

/**
 * Extracts the current value from a Signal, a bQuery `readonly()` wrapper, a
 * Computed, or returns the raw value as-is. This eliminates repetitive
 * `isSignal(x) ? x.value : x` patterns throughout user code.
 *
 * Reading a Signal or Computed via `toValue()` uses `.value`, so the
 * read **does** participate in reactive tracking when called inside
 * an effect or computed.
 *
 * @template T - The underlying value type
 * @param source - A plain value, Signal, bQuery readonly wrapper, or Computed
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
  if (source instanceof Signal || source instanceof Computed) {
    return source.value;
  }

  if (isReadonlySignal<T>(source)) {
    return source.value;
  }

  // Remaining values are plain `T` inputs. Structural readonly-like objects that are not
  // branded bQuery wrappers intentionally fall through and are returned unchanged.
  return source as T;
};
