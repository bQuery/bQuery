/**
 * SSR / Pre-rendering module for bQuery.js.
 *
 * Provides server-side rendering, hydration, and store state serialization
 * utilities for bQuery applications. Enables rendering bQuery templates
 * to HTML strings on the server, serializing store state for client pickup,
 * and hydrating the pre-rendered DOM on the client.
 *
 * ## Features
 *
 * - **`renderToString(template, data)`** — Server-side render a bQuery
 *   template to an `SSRResult` containing an `html` string with directive evaluation.
 * - **`hydrateMount(selector, context, { hydrate: true })`** — Reuse
 *   existing server-rendered DOM and attach reactive bindings.
 * - **`serializeStoreState(options?)`** — Serialize store state into a
 *   `<script>` tag for client-side pickup.
 * - **`deserializeStoreState()`** — Read serialized state on the client.
 * - **`hydrateStore(id, state)` / `hydrateStores(stateMap)`** — Apply
 *   server state to client stores.
 *
 * ## Usage
 *
 * ### Server
 * ```ts
 * import { renderToString, serializeStoreState } from '@bquery/bquery/ssr';
 *
 * const { html } = renderToString(
 *   '<div id="app"><h1 bq-text="title"></h1></div>',
 *   { title: 'Welcome' }
 * );
 *
 * const { scriptTag } = serializeStoreState();
 *
 * // Send to client: html + scriptTag
 * ```
 *
 * ### Client
 * ```ts
 * import { hydrateMount, deserializeStoreState, hydrateStores } from '@bquery/bquery/ssr';
 * import { signal } from '@bquery/bquery/reactive';
 *
 * // Restore store state from SSR
 * const ssrState = deserializeStoreState();
 * hydrateStores(ssrState);
 *
 * // Hydrate the DOM with reactive bindings
 * const title = signal('Welcome');
 * hydrateMount('#app', { title }, { hydrate: true });
 * ```
 *
 * @module bquery/ssr
 */

export { hydrateMount } from './hydrate';
export type { HydrateMountOptions } from './hydrate';
export { renderToString } from './render';
export {
  deserializeStoreState,
  hydrateStore,
  hydrateStores,
  serializeStoreState,
} from './serialize';
export type { SerializeResult } from './serialize';
export type {
  DeserializedStoreState,
  HydrationOptions,
  RenderOptions,
  SSRResult,
  SerializeOptions,
} from './types';
