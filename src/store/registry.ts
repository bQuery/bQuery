/**
 * Store registry utilities.
 */

import { unregisterDevtoolsStore } from './devtools';
import type { Store } from './types';

/** @internal Registry of all stores for devtools */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storeRegistry = new Map<string, Store<any, any, any>>();

/** @internal */
export const hasStore = (id: string): boolean => storeRegistry.has(id);

/** @internal */
export const registerStore = (
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: Store<any, any, any>
): void => {
  storeRegistry.set(id, store);
};

/**
 * Retrieves an existing store by its ID.
 *
 * @param id - The store identifier
 * @returns The store instance or undefined if not found
 */
export const getStore = <T = unknown>(id: string): T | undefined => {
  return storeRegistry.get(id) as T | undefined;
};

/**
 * Lists all registered store IDs.
 *
 * @returns Array of store IDs
 */
export const listStores = (): string[] => {
  return Array.from(storeRegistry.keys());
};

/**
 * Removes a store from the registry.
 *
 * @param id - The store identifier
 */
export const destroyStore = (id: string): void => {
  storeRegistry.delete(id);
  unregisterDevtoolsStore(id);
};
