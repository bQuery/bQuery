/**
 * Store factory helpers.
 */

import { createStore } from './create-store';
import { getStore, hasStore } from './registry';
import type { Store, StoreDefinition } from './types';

/**
 * Creates a store factory that returns the store instance.
 *
 * The store is lazily created on first call and cached in the global store
 * registry. Subsequent calls return the same instance. After calling
 * `destroyStore(id)`, the next factory call will create a fresh store.
 *
 * @param id - Store identifier
 * @param definition - Store definition without id
 * @returns A function that returns the store instance
 *
 * @example
 * ```ts
 * const useCounter = defineStore('counter', {
 *   state: () => ({ count: 0 }),
 *   actions: { increment() { this.count++; } },
 * });
 *
 * const counter = useCounter();
 * counter.increment();
 * ```
 */
export const defineStore = <
  S extends Record<string, unknown>,
  G extends Record<string, unknown> = Record<string, never>,
  A extends Record<string, (...args: unknown[]) => unknown> = Record<string, never>,
>(
  id: string,
  definition: Omit<StoreDefinition<S, G, A>, 'id'>
): (() => Store<S, G, A>) => {
  // Check registry first to avoid noisy warnings from createStore()
  // when the factory is called multiple times (intended usage pattern).
  // createStore() only called when store doesn't exist or was destroyed.
  return () => {
    if (hasStore(id)) {
      return getStore(id) as Store<S, G, A>;
    }
    return createStore({ id, ...definition });
  };
};
