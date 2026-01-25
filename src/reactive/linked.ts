/**
 * Linked (writable) computed helpers.
 */

import { computed, Computed } from './computed';

/**
 * A writable computed-like signal.
 */
export interface LinkedSignal<T> {
  /** Gets or sets the current value with dependency tracking. */
  value: T;
  /** Gets the current value without dependency tracking. */
  peek(): T;
}

/**
 * Creates a writable computed signal by linking a getter and setter.
 *
 * @template T - The derived value type
 * @param getValue - Getter that derives the current value
 * @param setValue - Setter that writes back to underlying signals
 * @returns A writable computed-like signal
 *
 * @example
 * ```ts
 * const first = signal('Ada');
 * const last = signal('Lovelace');
 * const fullName = linkedSignal(
 *   () => `${first.value} ${last.value}`,
 *   (next) => {
 *     const [a, b] = next.split(' ');
 *     first.value = a ?? '';
 *     last.value = b ?? '';
 *   }
 * );
 * ```
 */
export const linkedSignal = <T>(
  getValue: () => T,
  setValue: (value: T) => void
): LinkedSignal<T> => {
  const derived: Computed<T> = computed(getValue);

  return {
    get value(): T {
      return derived.value;
    },
    set value(next: T) {
      setValue(next);
    },
    peek(): T {
      return derived.peek();
    },
  };
};
