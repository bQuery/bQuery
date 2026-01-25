/**
 * Store factory helpers.
 */

import { createStore } from './create-store';
import type { Store, StoreDefinition } from './types';

/**
 * Creates a store factory that lazily instantiates a store on first call.
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
  let cachedStore: Store<S, G, A> | null = null;
  
  return () => {
    if (!cachedStore) {
      cachedStore = createStore({ id, ...definition });
    }
    return cachedStore;
  };
};
