/**
 * Store persistence helpers.
 */

import { createStore } from './create-store';
import type { Store, StoreDefinition } from './types';

/**
 * Creates a store with automatic persistence to localStorage.
 *
 * @param definition - Store definition
 * @param storageKey - Optional custom storage key
 * @returns The reactive store instance
 */
export const createPersistedStore = <
  S extends Record<string, unknown>,
  G extends Record<string, unknown> = Record<string, never>,
  A extends Record<string, (...args: unknown[]) => unknown> = Record<string, never>,
>(
  definition: StoreDefinition<S, G, A>,
  storageKey?: string
): Store<S, G, A> => {
  const key = storageKey ?? `bquery-store-${definition.id}`;

  const originalStateFactory = definition.state;

  const wrappedDefinition: StoreDefinition<S, G, A> = {
    ...definition,
    state: () => {
      const defaultState = originalStateFactory();

      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem(key);
          if (saved) {
            return { ...defaultState, ...JSON.parse(saved) } as S;
          }
        } catch {
          // Ignore parse errors
        }
      }

      return defaultState;
    },
  };

  const store = createStore(wrappedDefinition);

  // Subscribe to save changes
  store.$subscribe((state) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Ignore quota errors
      }
    }
  });

  return store;
};
