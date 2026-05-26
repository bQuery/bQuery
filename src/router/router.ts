/**
 * Router creation and lifecycle management.
 * @module bquery/router
 */

import { isPrototypePollutionKey } from '../core/utils/object';
import { readonly, signal, type ReadonlySignal, type Signal } from '../reactive/index';
import { createRoute } from './match';
import {
  beginNavigation,
  currentRoute,
  endNavigation,
  getActiveRouter,
  resetNavigationState,
  routeSignal,
  setActiveRouter,
} from './state';
import type {
  NavigationGuard,
  NavigationResult,
  ResolvedRouteInfo,
  ResolveRouteInput,
  Route,
  RouteDefinition,
  Router,
  RouterOptions,
} from './types';
import { flattenRoutes, resolveNamedRoutePath } from './utils';

// ============================================================================
// Router Creation
// ============================================================================

const MAX_SCROLL_POSITION_ENTRIES = 100;

const cloneRouteDefinition = (route: RouteDefinition): RouteDefinition => {
  if ('redirectTo' in route) {
    return { ...route };
  }

  const clonedRoute = { ...route } as RouteDefinition & { children?: RouteDefinition[] };
  if (Array.isArray(route.children)) {
    clonedRoute.children = route.children.map(cloneRouteDefinition);
  }

  return clonedRoute;
};

const sanitizeHistoryState = (state: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(state)) {
    if (isPrototypePollutionKey(key)) continue;
    sanitized[key] = value;
  }

  return sanitized;
};

/**
 * Creates and initializes a router instance.
 *
 * @param options - Router configuration
 * @returns The router instance
 *
 * @example
 * ```ts
 * import { createRouter } from 'bquery/router';
 *
 * const router = createRouter({
 *   routes: [
 *     { path: '/', component: () => import('./pages/Home') },
 *     { path: '/about', component: () => import('./pages/About') },
 *     { path: '/user/:id(\\d+)', component: () => import('./pages/User') },
 *     { path: '/old-page', redirectTo: '/new-page' },
 *     { path: '*', component: () => import('./pages/NotFound') },
 *   ],
 *   base: '/app',
 *   scrollRestoration: true,
 * });
 *
 * router.beforeEach((to, from) => {
 *   if (to.path === '/admin' && !isAuthenticated()) {
 *     return false; // Cancel navigation
 *   }
 * });
 * ```
 */
export const createRouter = (options: RouterOptions): Router => {
  // Clean up any existing router to prevent guard leakage
  const existingRouter = getActiveRouter();
  if (existingRouter) {
    existingRouter.destroy();
  }

  const { routes, base = '', hash: useHash = false, scrollRestoration = false } = options;

  // Instance-specific guards and hooks (not shared globally)
  const beforeGuards: NavigationGuard[] = [];
  const beforeResolveGuards: NavigationGuard[] = [];
  const afterHooks: Array<(to: Route, from: Route) => void> = [];

  // Track the underlying (mutable) route definitions for dynamic add/remove.
  // We store a recursive working copy so addRoute/removeRoute can mutate
  // without affecting the caller's route objects or child arrays.
  const rootRoutes: RouteDefinition[] = routes.map(cloneRouteDefinition);

  // Flatten nested routes (base-relative, not including the base path).
  let flatRoutes = flattenRoutes(rootRoutes);

  // Reactive signal for the most recent navigation result.
  const lastNavigationSignal: Signal<NavigationResult | null> = signal<NavigationResult | null>(
    null
  );
  const lastNavigation: ReadonlySignal<NavigationResult | null> = readonly(lastNavigationSignal);

  // isReady support: resolved after the first syncRoute call settles.
  let readyPromise: Promise<void>;
  let resolveReady: () => void = () => {};
  readyPromise = new Promise<void>((res) => {
    resolveReady = res;
  });
  let isReadyResolved = false;
  const markReady = (): void => {
    if (!isReadyResolved) {
      isReadyResolved = true;
      resolveReady();
    }
  };

  // Scroll position storage keyed by history state id
  const scrollPositions = new Map<string, { x: number; y: number }>();
  let currentScrollKey = '0';
  let scrollKeyCounter = 0;
  let previousScrollRestoration: History['scrollRestoration'] | null = null;

  // Enable manual scroll restoration if scrollRestoration is configured
  if (scrollRestoration && typeof history !== 'undefined' && 'scrollRestoration' in history) {
    previousScrollRestoration = history.scrollRestoration;
    if (history.scrollRestoration !== 'manual') {
      history.scrollRestoration = 'manual';
    }

    const state =
      history.state && typeof history.state === 'object'
        ? (history.state as Record<string, unknown>)
        : {};

    if (typeof state.__bqScrollKey !== 'string') {
      const currentUrl = useHash
        ? window.location.hash || '#/'
        : `${window.location.pathname}${window.location.search}${window.location.hash}`;
      history.replaceState({ ...state, __bqScrollKey: currentScrollKey }, '', currentUrl);
    }
  }

  /**
   * Generates a unique key for the current history entry.
   * @internal
   */
  const getScrollKey = (): string => {
    return (history.state && history.state.__bqScrollKey) || currentScrollKey;
  };

  /**
   * Generates a unique key for a new history entry.
   * @internal
   */
  const createScrollKey = (): string => `${Date.now()}-${scrollKeyCounter++}`;

  /**
   * Saves current scroll position for the current history entry.
   * @internal
   */
  const saveScrollPosition = (key = getScrollKey()): void => {
    if (!scrollRestoration) return;
    if (scrollPositions.has(key)) {
      // Refresh the insertion order so pruning behaves like an LRU cache.
      scrollPositions.delete(key);
    }
    scrollPositions.set(key, { x: window.scrollX, y: window.scrollY });
    while (scrollPositions.size > MAX_SCROLL_POSITION_ENTRIES) {
      const oldestKey = scrollPositions.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        break;
      }
      scrollPositions.delete(oldestKey);
    }
  };

  /**
   * Restores scroll position for the current history entry.
   * @internal
   */
  const restoreScrollPosition = (key = getScrollKey()): void => {
    if (!scrollRestoration) return;
    const pos = scrollPositions.get(key);
    if (pos) {
      window.scrollTo(pos.x, pos.y);
    } else {
      window.scrollTo(0, 0);
    }
  };

  /**
   * Builds history state for canceled navigations without dropping
   * the scroll restoration key for the current entry.
   * @internal
   */
  const getRestoreHistoryState = (): Record<string, unknown> => {
    const state =
      history.state && typeof history.state === 'object'
        ? { ...(history.state as Record<string, unknown>) }
        : {};

    if (scrollRestoration) {
      state.__bqScrollKey = currentScrollKey;
    }

    return state;
  };

  /**
   * Gets the current path from the URL.
   */
  const getCurrentPath = (): { pathname: string; search: string; hash: string } => {
    if (useHash) {
      const hashPath = window.location.hash.slice(1) || '/';
      // In hash routing, URL structure is #/path?query#fragment
      // Extract hash fragment first (after the second #)
      const [pathWithQuery, hashPart = ''] = hashPath.split('#');
      // Then extract query from the path
      const [pathname, search = ''] = pathWithQuery.split('?');
      return {
        pathname,
        search: search ? `?${search}` : '',
        hash: hashPart ? `#${hashPart}` : '',
      };
    }

    let pathname = window.location.pathname;
    if (base && (pathname === base || pathname.startsWith(base + '/'))) {
      pathname = pathname.slice(base.length) || '/';
    }

    return {
      pathname,
      search: window.location.search,
      hash: window.location.hash,
    };
  };

  /**
   * Updates the route signal with current URL state.
   */
  const syncRoute = (): void => {
    const { pathname, search, hash } = getCurrentPath();
    const newRoute = createRoute(pathname, search, hash, flatRoutes);
    routeSignal.value = newRoute;
  };

  /**
   * Performs navigation with guards. Returns a structured NavigationResult.
   */
  const performNavigation = async (
    path: string,
    method: 'pushState' | 'replaceState',
    visitedPaths: Set<string> = new Set(),
    throwOnError = false
  ): Promise<NavigationResult> => {
    beginNavigation();
    let from: Route | undefined;
    try {
      const current = getCurrentPath();
      from = createRoute(current.pathname, current.search, current.hash, flatRoutes);

      // Parse the target path
      const url = new URL(path, window.location.origin);
      const resolvedPath = `${url.pathname}${url.search}${url.hash}`;
      if (visitedPaths.has(resolvedPath)) {
        throw new Error(`bQuery router: redirect loop detected for path "${resolvedPath}"`);
      }
      visitedPaths.add(resolvedPath);
      const to = createRoute(url.pathname, url.search, url.hash, flatRoutes);

      // Check for redirectTo on the matched route
      if (to.matched?.redirectTo) {
        // Navigate to the redirect target instead
        const inner = await performNavigation(to.matched.redirectTo, method, visitedPaths, throwOnError);
        const redirected: NavigationResult = {
          status: inner.status === 'completed' ? 'redirected' : inner.status,
          requestedPath: path,
          to: inner.to,
          from: inner.from ?? from,
          error: inner.error,
        };
        lastNavigationSignal.value = redirected;
        return redirected;
      }

      // Run route-level beforeEnter guard
      if (to.matched?.beforeEnter) {
        const result = await to.matched.beforeEnter(to, from);
        if (result === false) {
          const canceled: NavigationResult = {
            status: 'canceled',
            requestedPath: path,
            to,
            from,
          };
          lastNavigationSignal.value = canceled;
          return canceled;
        }
      }

      // Run beforeEach guards
      for (const guard of beforeGuards) {
        const result = await guard(to, from);
        if (result === false) {
          const canceled: NavigationResult = {
            status: 'canceled',
            requestedPath: path,
            to,
            from,
          };
          lastNavigationSignal.value = canceled;
          return canceled;
        }
      }

      // Run beforeResolve guards (after beforeEach/beforeEnter, before commit).
      for (const guard of beforeResolveGuards) {
        const result = await guard(to, from);
        if (result === false) {
          const canceled: NavigationResult = {
            status: 'canceled',
            requestedPath: path,
            to,
            from,
          };
          lastNavigationSignal.value = canceled;
          return canceled;
        }
      }

      // Save scroll position before navigation
      saveScrollPosition();

      // Update browser history
      const existingScrollKey = scrollRestoration ? getScrollKey() : undefined;
      const scrollKey =
        method === 'replaceState' && existingScrollKey ? existingScrollKey : createScrollKey();
      const fullPath = useHash ? `#${path}` : `${base}${path}`;
      const baseState =
        scrollRestoration && history.state && typeof history.state === 'object'
          ? sanitizeHistoryState(history.state as Record<string, unknown>)
          : {};
      const state = scrollRestoration ? { ...baseState, __bqScrollKey: scrollKey } : {};
      history[method](state, '', fullPath);
      currentScrollKey = scrollKey;

      // Update route signal
      syncRoute();

      // Scroll to top on push navigation
      if (scrollRestoration && method === 'pushState') {
        window.scrollTo(0, 0);
      }

      // Run afterEach hooks
      for (const hook of afterHooks) {
        hook(routeSignal.value, from);
      }

      const completed: NavigationResult = {
        status: 'completed',
        requestedPath: path,
        to: routeSignal.value,
        from,
      };
      lastNavigationSignal.value = completed;
      return completed;
    } catch (error) {
      const errored: NavigationResult = {
        status: 'error',
        requestedPath: path,
        from,
        error,
      };
      lastNavigationSignal.value = errored;
      if (throwOnError) {
        throw error;
      }
      return errored;
    } finally {
      endNavigation();
    }
  };

  /**
   * Handle popstate events (back/forward).
   */
  const handlePopState = async (event: PopStateEvent): Promise<void> => {
    beginNavigation();
    try {
      const { pathname, search, hash } = getCurrentPath();
      const from = routeSignal.value;
      const to = createRoute(pathname, search, hash, flatRoutes);

      // Check for redirectTo on the matched route
      if (to.matched?.redirectTo) {
        await performNavigation(to.matched.redirectTo, 'replaceState');
        return;
      }

      // Run route-level beforeEnter guard
      if (to.matched?.beforeEnter) {
        const result = await to.matched.beforeEnter(to, from);
        if (result === false) {
          // Restore previous state with full URL (including query/hash)
          const queryString = new URLSearchParams(
            Object.entries(from.query).flatMap(([key, value]) =>
              Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]]
            )
          ).toString();
          const searchStr = queryString ? `?${queryString}` : '';
          const hashStr = from.hash ? `#${from.hash}` : '';
          const restorePath = useHash
            ? `#${from.path}${searchStr}${hashStr}`
            : `${base}${from.path}${searchStr}${hashStr}`;
          history.replaceState(getRestoreHistoryState(), '', restorePath);
          return;
        }
      }

      // Run beforeEach guards (supports async guards)
      for (const guard of beforeGuards) {
        const result = await guard(to, from);
        if (result === false) {
          // Restore previous state with full URL (including query/hash)
          const queryString = new URLSearchParams(
            Object.entries(from.query).flatMap(([key, value]) =>
              Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]]
            )
          ).toString();
          const search = queryString ? `?${queryString}` : '';
          const hash = from.hash ? `#${from.hash}` : '';
          const restorePath = useHash
            ? `#${from.path}${search}${hash}`
            : `${base}${from.path}${search}${hash}`;
          history.replaceState(getRestoreHistoryState(), '', restorePath);
          return;
        }
      }

      // Save scroll position of the page we're leaving
      saveScrollPosition(currentScrollKey);

      // Update scroll key from history state
      currentScrollKey =
        (event.state as { __bqScrollKey?: string } | null)?.__bqScrollKey ?? getScrollKey();

      syncRoute();

      // Restore scroll position for the entry we're navigating to
      restoreScrollPosition(currentScrollKey);

      for (const hook of afterHooks) {
        hook(routeSignal.value, from);
      }
    } finally {
      endNavigation();
    }
  };

  // Attach popstate listener
  window.addEventListener('popstate', handlePopState);

  // Helper to mutate flatRoutes in place when rootRoutes changes (used by
  // addRoute/removeRoute so the router.routes reference stays stable).
  const rebuildFlatRoutes = (): void => {
    const next = flattenRoutes(rootRoutes);
    flatRoutes.length = 0;
    flatRoutes.push(...next);
  };

  // Build a path string with optional query and hash (used by resolveRoute).
  const buildSearchString = (
    query: Record<
      string,
      string | number | boolean | Array<string | number | boolean>
    > | undefined
  ): string => {
    if (!query) return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (isPrototypePollutionKey(key)) continue;
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, String(v));
      } else if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    const str = params.toString();
    return str ? `?${str}` : '';
  };

  const normalizeHash = (hash: string | undefined): string => {
    if (!hash) return '';
    return hash.startsWith('#') ? hash : `#${hash}`;
  };

  const resolveRoute = (input: ResolveRouteInput): ResolvedRouteInfo => {
    let pathOnly: string;
    let searchStr = '';
    let hashPart = '';

    if (typeof input === 'string') {
      // Parse the raw string path.
      // Use a synthetic base for relative-path parsing.
      const url = new URL(input, 'http://__bq_resolve__/');
      pathOnly = url.pathname;
      const searchStr = url.search ?? '';
      const hashStr = url.hash ?? '';
      const href = useHash
        ? `#${pathOnly}${searchStr}${hashStr}`
        : `${base}${pathOnly}${searchStr}${hashStr}`;
      const matchedRoute = createRoute(pathOnly, searchStr, hashStr.replace(/^#/, ''), flatRoutes);
      return {
        path: `${pathOnly}${searchStr}${hashStr}`,
        href,
        matched: matchedRoute.matched,
      };
    }

    if (input.path !== undefined) {
      const url = new URL(input.path, 'http://__bq_resolve__/');
      pathOnly = url.pathname;
      searchStr = input.query === undefined ? (url.search ?? '') : buildSearchString(input.query);
      hashPart = input.hash === undefined ? (url.hash ?? '') : normalizeHash(input.hash);
    } else if (input.name !== undefined) {
      pathOnly = resolveNamedRoutePath(flatRoutes, input.name, input.params ?? {});
      searchStr = buildSearchString(input.query);
      hashPart = normalizeHash(input.hash);
    } else {
      throw new Error('bQuery router: resolveRoute requires either `path` or `name`.');
    }

    const fullPath = `${pathOnly}${searchStr}${hashPart}`;
    const matchedRoute = createRoute(pathOnly, searchStr, hashPart.replace(/^#/, ''), flatRoutes);
    const href = useHash ? `#${fullPath}` : `${base}${fullPath}`;
    return {
      path: fullPath,
      href,
      matched: matchedRoute.matched,
    };
  };

  const findRouteByName = (
    list: RouteDefinition[],
    name: string
  ): { parent: RouteDefinition[] | null; index: number } => {
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r.name === name) {
        return { parent: list, index: i };
      }
      if ('children' in r && Array.isArray(r.children)) {
        const found = findRouteByName(r.children, name);
        if (found.parent) return found;
      }
    }
    return { parent: null, index: -1 };
  };

  const hasRoute = (name: string): boolean => findRouteByName(rootRoutes, name).parent !== null;

  const addRoute = (parentName: string | undefined, route: RouteDefinition): void => {
    const nextRoute = cloneRouteDefinition(route);
    // Replace any existing entry with the same name first.
    if (nextRoute.name) removeRoute(nextRoute.name);
    if (parentName === undefined) {
      rootRoutes.push(nextRoute);
    } else {
      const found = findRouteByName(rootRoutes, parentName);
      if (!found.parent) {
        throw new Error(`bQuery router: parent route "${parentName}" not found.`);
      }
      const parent = found.parent[found.index] as RouteDefinition & {
        children?: RouteDefinition[];
      };
      if (!parent.children) {
        (parent as { children?: RouteDefinition[] }).children = [nextRoute];
      } else {
        parent.children.push(nextRoute);
      }
    }
    rebuildFlatRoutes();
  };

  const removeRoute = (name: string): boolean => {
    const found = findRouteByName(rootRoutes, name);
    if (!found.parent) return false;
    found.parent.splice(found.index, 1);
    rebuildFlatRoutes();
    return true;
  };

  // Initialize route
  syncRoute();
  // First sync done; mark the router ready on next microtask so that any
  // queued microtasks scheduled during construction can settle first.
  Promise.resolve().then(markReady);

  const router: Router = {
    push: async (path: string) => {
      await performNavigation(path, 'pushState', new Set(), true);
    },
    replace: async (path: string) => {
      await performNavigation(path, 'replaceState', new Set(), true);
    },
    pushResult: (path: string) => performNavigation(path, 'pushState'),
    replaceResult: (path: string) => performNavigation(path, 'replaceState'),
    back: () => history.back(),
    forward: () => history.forward(),
    go: (delta: number) => history.go(delta),

    beforeEach: (guard: NavigationGuard) => {
      beforeGuards.push(guard);
      return () => {
        const index = beforeGuards.indexOf(guard);
        if (index > -1) beforeGuards.splice(index, 1);
      };
    },

    beforeResolve: (guard: NavigationGuard) => {
      beforeResolveGuards.push(guard);
      return () => {
        const index = beforeResolveGuards.indexOf(guard);
        if (index > -1) beforeResolveGuards.splice(index, 1);
      };
    },

    afterEach: (hook: (to: Route, from: Route) => void) => {
      afterHooks.push(hook);
      return () => {
        const index = afterHooks.indexOf(hook);
        if (index > -1) afterHooks.splice(index, 1);
      };
    },

    resolveRoute,
    hasRoute,
    addRoute,
    removeRoute,

    isReady: () => readyPromise,
    lastNavigation,

    currentRoute,
    routes: flatRoutes,
    base,
    hash: useHash,

    destroy: () => {
      window.removeEventListener('popstate', handlePopState);
      beforeGuards.length = 0;
      beforeResolveGuards.length = 0;
      afterHooks.length = 0;
      scrollPositions.clear();
      // Restore the previous scroll restoration mode on destroy
      if (
        previousScrollRestoration !== null &&
        typeof history !== 'undefined' &&
        'scrollRestoration' in history
      ) {
        history.scrollRestoration = previousScrollRestoration;
      }
      resetNavigationState();
      setActiveRouter(null);
    },
  };

  setActiveRouter(router);
  return router;
};
