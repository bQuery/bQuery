/**
 * Store state serialization for SSR.
 *
 * Provides utilities to serialize store state into a `<script>` tag
 * for client-side hydration, and to deserialize state on the client.
 *
 * @module bquery/ssr
 */

import { getStore, listStores } from '../store/index';
import { isPrototypePollutionKey } from '../core/utils/object';
import { escapeForHtmlAttribute, escapeForScript } from './escape';
import type { DeserializedStoreState, SerializeOptions } from './types';

const isStoreStateObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeHydrationState = (value: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (isPrototypePollutionKey(key)) continue;
    sanitized[key] = entryValue;
  }
  return sanitized;
};

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

  if (isPrototypePollutionKey(globalKey)) {
    throw new Error(
      `serializeStoreState: invalid globalKey "${globalKey}" - prototype-pollution keys are not allowed.`
    );
  }

  if (isPrototypePollutionKey(scriptId)) {
    throw new Error(
      `serializeStoreState: invalid scriptId "${scriptId}" - prototype-pollution keys are not allowed.`
    );
  }

  const ids = storeIds ?? listStores();
  const stateMap = Object.create(null) as Record<string, Record<string, unknown>>;

  for (const id of ids) {
    if (isPrototypePollutionKey(id)) {
      continue;
    }

    const store = getStore<{ $state: Record<string, unknown> }>(id);
    if (store) {
      stateMap[id] = sanitizeHydrationState(store.$state);
    }
  }

  const stateJson = serialize(stateMap);
  if (typeof stateJson !== 'string') {
    throw new Error('serializeStoreState: custom serialize function must return a string.');
  }

  if (serialize !== JSON.stringify) {
    let parsedStateJson: unknown;
    try {
      parsedStateJson = JSON.parse(stateJson);
    } catch {
      throw new Error('serializeStoreState: custom serialize function returned invalid JSON.');
    }

    if (!isStoreStateObject(parsedStateJson)) {
      throw new Error(
        'serializeStoreState: custom serialize function must return a JSON object string.'
      );
    }
  }

  const escapedJson = escapeForScript(stateJson);
  const escapedGlobalKey = escapeForScript(JSON.stringify(globalKey));
  const escapedScriptId = escapeForHtmlAttribute(scriptId);
  const scriptTag = `<script id="${escapedScriptId}">window[${escapedGlobalKey}]=${escapedJson}</script>`;

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
 * @param scriptId - The ID of the SSR script tag to remove after hydration
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
  globalKey = '__BQUERY_INITIAL_STATE__',
  scriptId = '__BQUERY_STORE_STATE__'
): DeserializedStoreState => {
  if (isPrototypePollutionKey(globalKey)) {
    throw new Error(
      `deserializeStoreState: invalid globalKey "${globalKey}" - prototype-pollution keys are not allowed.`
    );
  }

  if (isPrototypePollutionKey(scriptId)) {
    throw new Error(
      `deserializeStoreState: invalid scriptId "${scriptId}" - prototype-pollution keys are not allowed.`
    );
  }

  if (typeof window === 'undefined') {
    return {};
  }

  const state = (window as unknown as Record<string, unknown>)[globalKey];
  if (!state) {
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
  if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
    const scriptEl = document.getElementById(scriptId);
    if (scriptEl) {
      scriptEl.remove();
    }
  }

  if (!isStoreStateObject(state)) {
    return {};
  }

  for (const value of Object.values(state)) {
    if (!isStoreStateObject(value)) {
      return {};
    }
  }

  const sanitizedStateMap = Object.create(null) as DeserializedStoreState;

  for (const [storeId, storeState] of Object.entries(state)) {
    if (isPrototypePollutionKey(storeId) || !isStoreStateObject(storeState)) {
      continue;
    }

    sanitizedStateMap[storeId] = sanitizeHydrationState(storeState);
  }

  return sanitizedStateMap;
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
    store.$patch(sanitizeHydrationState(state));
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
