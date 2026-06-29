/**
 * Client-side glue that runs a file route's `load` on navigation and exposes
 * the result reactively — the browser counterpart to the SSR router bridge.
 *
 * The loader runs whenever the active route changes (mirroring how the server
 * runs it before render), with stale-response guarding so a slow loader for a
 * route you have already navigated away from cannot clobber fresher data.
 *
 * @module bquery/router
 */

import { effect, readonly, signal, type ReadonlySignal } from '../../reactive/index';
import type { Route, RouteDefinition, Router } from '../types';
import type { Action, Load } from './types';

interface MetaWithRouteData {
  load?: Load;
  action?: Action;
}

const readMeta = (route: Route | RouteDefinition | null): MetaWithRouteData | undefined => {
  if (!route) return undefined;
  const def = 'matched' in route ? route.matched : route;
  return (def?.meta as MetaWithRouteData | undefined) ?? undefined;
};

/** Read the `load` attached to a route by {@link createFileRoutes}, if any. */
export const getRouteLoad = (route: Route | RouteDefinition | null): Load | undefined =>
  readMeta(route)?.load;

/** Read the `action` attached to a route by {@link createFileRoutes}, if any. */
export const getRouteAction = (route: Route | RouteDefinition | null): Action | undefined =>
  readMeta(route)?.action;

/** Options for {@link createRouteData}. */
export interface RouteDataOptions {
  /** Ambient context forwarded to the loader (rarely needed on the client). */
  ctx?: unknown;
  /** Request forwarded to the loader (e.g. when replaying a server request). */
  request?: Request;
  /** Abort signal forwarded to the loader. */
  signal?: AbortSignal;
  /** Override how the loader's `url` is derived from a route. */
  urlFor?: (route: Route) => URL;
}

/** A reactive handle over the active route's loaded data. */
export interface RouteData<T = unknown> {
  /** The most recently loaded data, or `undefined` before the first load. */
  data: ReadonlySignal<T | undefined>;
  /** `true` while a loader is in flight. */
  pending: ReadonlySignal<boolean>;
  /** The error from the most recent failed load, or `null`. */
  error: ReadonlySignal<unknown>;
  /** Re-run the loader for the current route. */
  refresh: () => Promise<void>;
  /** Stop reacting to route changes. */
  destroy: () => void;
}

const resolveUrl = (route: Route, options: RouteDataOptions): URL => {
  if (options.urlFor) return options.urlFor(route);
  const href = (globalThis as { location?: { href?: string } }).location?.href;
  if (href) return new URL(href);
  return new URL(route.path || '/', 'http://localhost/');
};

let activeRouteData: RouteData<unknown> | null = null;

/**
 * Subscribe to a router and run the matched route's `load` on every
 * navigation, exposing `data` / `pending` / `error` signals. The returned
 * handle is also registered as the ambient handle read by {@link useRouteData}.
 *
 * @example
 * ```ts
 * const router = createRouter({ routes });
 * const { data, pending } = createRouteData(router);
 * effect(() => render(data.value));
 * ```
 */
export const createRouteData = <T = unknown>(
  router: Router,
  options: RouteDataOptions = {}
): RouteData<T> => {
  const data = signal<T | undefined>(undefined);
  const pending = signal(false);
  const error = signal<unknown>(null);
  let token = 0;
  let lastRoute: Route | null = null;

  const run = async (route: Route): Promise<void> => {
    lastRoute = route;
    const load = getRouteLoad(route);
    if (!load) {
      token += 1;
      data.value = undefined;
      error.value = null;
      pending.value = false;
      return;
    }
    const current = ++token;
    pending.value = true;
    error.value = null;
    try {
      const result = (await load({
        params: route.params,
        url: resolveUrl(route, options),
        request: options.request,
        ctx: options.ctx,
        signal: options.signal,
      })) as T;
      if (current === token) data.value = result;
    } catch (caught) {
      if (current === token) error.value = caught;
    } finally {
      if (current === token) pending.value = false;
    }
  };

  const dispose = effect(() => {
    const route = router.currentRoute.value;
    void run(route);
  });

  const handle: RouteData<T> = {
    data: readonly(data),
    pending: readonly(pending),
    error: readonly(error),
    refresh: () => run(lastRoute ?? router.currentRoute.value),
    destroy: () => {
      dispose();
      if (activeRouteData === (handle as RouteData<unknown>)) activeRouteData = null;
    },
  };

  activeRouteData = handle as RouteData<unknown>;
  return handle;
};

/**
 * Read the ambient {@link RouteData} handle created by the most recent
 * {@link createRouteData} call. Returns an inert handle if none exists yet, so
 * components can call it unconditionally.
 *
 * @example
 * ```ts
 * const { data, pending } = useRouteData<{ user: User }>();
 * ```
 */
export const useRouteData = <T = unknown>(): RouteData<T> => {
  if (activeRouteData) return activeRouteData as RouteData<T>;
  const empty = signal<T | undefined>(undefined);
  const pending = signal(false);
  const error = signal<unknown>(null);
  return {
    data: readonly(empty),
    pending: readonly(pending),
    error: readonly(error),
    refresh: async () => {},
    destroy: () => {},
  };
};
