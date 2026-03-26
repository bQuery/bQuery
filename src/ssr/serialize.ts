/**
 * Store state serialization for SSR.
 *
 * Provides utilities to serialize store state into a `<script>` tag
 * for client-side hydration, and to deserialize state on the client.
 *
 * @module bquery/ssr
 */

import { getStore, listStores } from '../store/index';
import type { DeserializedStoreState, SerializeOptions } from './types';

/**
 * Result of store state serialization.
 */
export type SerializeResult = {
  /** JSON string of the state map */
  stateJson: string;
  /** Complete `<script>` tag ready to embed in HTML */
  scriptTag: string;
};

/**
 * Escapes a string for safe embedding in a `<script>` tag.
 * Prevents XSS via `</script>` injection and HTML entities.
 *
 * @internal
 */
const escapeForScript = (str: string): string => {
  return str
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\//g, '\\u002f')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
};

/**
 * Serializes the state of registered stores into a JSON string and
 * a `<script>` tag suitable for embedding in server-rendered HTML.
 *
 * The serialized state can be picked up on the client using
 * `deserializeStoreState()` to restore stores to their server-side values.
 *
 * @param options - Serialization options
 * @returns Object with JSON string and ready-to-use script tag
 *
 * @example
 * ```ts
 * import { serializeStoreState } from '@bquery/bquery/ssr';
 * import { createStore } from '@bquery/bquery/store';
 *
 * const store = createStore({
 *   id: 'counter',
 *   state: () => ({ count: 42 }),
 * });
 *
 * const { scriptTag } = serializeStoreState();
 * // '<script id="__BQUERY_STORE_STATE__">window.__BQUERY_INITIAL_STATE__={"counter":{"count":42}}</script>'
 * ```
 *
 * @example
 * ```ts
 * // Serialize only specific stores
 * const { scriptTag } = serializeStoreState({ storeIds: ['counter'] });
 * ```
 */
export const serializeStoreState = (options: SerializeOptions = {}): SerializeResult => {
  const {
    scriptId = '__BQUERY_STORE_STATE__',
    globalKey = '__BQUERY_INITIAL_STATE__',
    storeIds,
    serialize = JSON.stringify,
  } = options;

  const ids = storeIds ?? listStores();
  const stateMap: Record<string, Record<string, unknown>> = {};

  for (const id of ids) {
     
    const store = getStore<{ $state: Record<string, unknown> }>(id);
    if (store) {
      stateMap[id] = store.$state;
    }
  }

  const stateJson = serialize(stateMap);
  const escapedJson = escapeForScript(stateJson);
  const scriptTag = `<script id="${scriptId}">window.${globalKey}=${escapedJson}</script>`;

  return { stateJson, scriptTag };
};

/**
 * Deserializes store state from the global variable set by the SSR script tag.
 *
 * Call this on the client before creating stores to pre-populate them with
 * server-rendered state. After deserialization, the script tag and global
 * variable are cleaned up automatically.
 *
 * @param globalKey - The global variable name where state was serialized
 * @returns The deserialized state map, or an empty object if not found
 *
 * @example
 * ```ts
 * import { deserializeStoreState } from '@bquery/bquery/ssr';
 *
 * // Call before creating stores
 * const state = deserializeStoreState();
 * // state = { counter: { count: 42 } }
 * ```
 */
export const deserializeStoreState = (
  globalKey = '__BQUERY_INITIAL_STATE__'
): DeserializedStoreState => {
  if (typeof window === 'undefined') {
    return {};
  }

  const state = (window as unknown as Record<string, unknown>)[globalKey];
  if (!state || typeof state !== 'object') {
    return {};
  }

  // Clean up global variable
  try {
    delete (window as unknown as Record<string, unknown>)[globalKey];
  } catch {
    // In strict mode on some environments, delete may fail
    (window as unknown as Record<string, unknown>)[globalKey] = undefined;
  }

  // Clean up script tag
  const scriptEl = document.getElementById('__BQUERY_STORE_STATE__');
  if (scriptEl) {
    scriptEl.remove();
  }

  return state as DeserializedStoreState;
};

/**
 * Hydrates a store with pre-serialized state from SSR.
 *
 * If the store exists and has a `$patch` method, this applies the
 * deserialized state as a patch. Otherwise, the state is ignored.
 *
 * @param storeId - The store ID to hydrate
 * @param state - The plain state object to apply
 *
 * @example
 * ```ts
 * import { hydrateStore, deserializeStoreState } from '@bquery/bquery/ssr';
 * import { createStore } from '@bquery/bquery/store';
 *
 * // 1. Deserialize state from SSR script tag
 * const ssrState = deserializeStoreState();
 *
 * // 2. Create store (gets initial values from factory)
 * const store = createStore({
 *   id: 'counter',
 *   state: () => ({ count: 0 }),
 * });
 *
 * // 3. Apply SSR state
 * if (ssrState.counter) {
 *   hydrateStore('counter', ssrState.counter);
 * }
 * // store.count is now 42 (from SSR)
 * ```
 */
export const hydrateStore = (storeId: string, state: Record<string, unknown>): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = getStore<{ $patch?: (partial: any) => void }>(storeId);
  if (store && typeof store.$patch === 'function') {
    store.$patch(state);
  }
};

/**
 * Hydrates all stores at once from a deserialized state map.
 *
 * Convenience wrapper that calls `hydrateStore` for each entry in the state map.
 *
 * @param stateMap - Map of store IDs to their state objects
 *
 * @example
 * ```ts
 * import { hydrateStores, deserializeStoreState } from '@bquery/bquery/ssr';
 *
 * const ssrState = deserializeStoreState();
 * hydrateStores(ssrState);
 * ```
 */
export const hydrateStores = (stateMap: DeserializedStoreState): void => {
  for (const [storeId, state] of Object.entries(stateMap)) {
    hydrateStore(storeId, state);
  }
};
