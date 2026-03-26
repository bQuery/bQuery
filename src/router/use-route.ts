/**
 * Reactive route composable.
 * @module bquery/router
 */

import { computed, type ReadonlySignal } from '../reactive/index';
import { routeSignal } from './state';
import type { Route, RouteDefinition } from './types';

// ============================================================================
// useRoute Composable
// ============================================================================

/**
 * Return type for {@link useRoute}.
 * Provides reactive access to individual route properties.
 */
export type UseRouteReturn = {
  /** Full reactive route object */
  route: ReadonlySignal<Route>;
  /** Reactive current path */
  path: ReadonlySignal<string>;
  /** Reactive route params */
  params: ReadonlySignal<Record<string, string>>;
  /** Reactive query params */
  query: ReadonlySignal<Record<string, string | string[]>>;
  /** Reactive hash fragment (without #) */
  hash: ReadonlySignal<string>;
  /** Reactive matched route definition */
  matched: ReadonlySignal<RouteDefinition | null>;
};

/**
 * Returns reactive access to the current route, params, query, and hash.
 *
 * Each property is a readonly computed signal that updates automatically
 * when the route changes. This is useful for fine-grained reactivity
 * where you only need to subscribe to specific route parts.
 *
 * @returns An object with reactive route properties
 *
 * @example
 * ```ts
 * import { useRoute } from 'bquery/router';
 * import { effect } from 'bquery/reactive';
 *
 * const { path, params, query, hash } = useRoute();
 *
 * effect(() => {
 *   console.log('Path:', path.value);
 *   console.log('Params:', params.value);
 *   console.log('Query:', query.value);
 *   console.log('Hash:', hash.value);
 * });
 * ```
 */
export const useRoute = (): UseRouteReturn => {
  const route = computed(() => routeSignal.value);
  const path = computed(() => routeSignal.value.path);
  const params = computed(() => routeSignal.value.params);
  const query = computed(() => routeSignal.value.query);
  const hash = computed(() => routeSignal.value.hash);
  const matched = computed(() => routeSignal.value.matched);

  return { route, path, params, query, hash, matched };
};
