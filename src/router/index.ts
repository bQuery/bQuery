/**
 * Minimal SPA router with History API integration.
 *
 * This module provides a lightweight, signal-based router for single-page
 * applications. Features include:
 * - History API navigation
 * - Route matching with params and wildcards
 * - Lazy route loading
 * - Navigation guards (beforeEach, afterEach)
 * - Reactive current route via signals
 * - Multi-value query params (e.g., `?tag=a&tag=b` → `{ tag: ['a', 'b'] }`)
 *
 * @module bquery/router
 *
 * @example
 * ```ts
 * import { createRouter, navigate, currentRoute } from 'bquery/router';
 * import { effect } from 'bquery/reactive';
 *
 * const router = createRouter({
 *   routes: [
 *     { path: '/', component: () => import('./Home') },
 *     { path: '/user/:id', component: () => import('./User') },
 *     { path: '*', component: () => import('./NotFound') },
 *   ],
 * });
 *
 * effect(() => {
 *   console.log('Route changed:', currentRoute.value);
 * });
 *
 * navigate('/user/42');
 * ```
 */

import { computed, signal, type ReadonlySignal, type Signal } from '../reactive/index';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a parsed route with matched params.
 */
export type Route = {
  /** The current path (e.g., '/user/42') */
  path: string;
  /** Extracted route params (e.g., { id: '42' }) */
  params: Record<string, string>;
  /**
   * Query string params.
   * Single values are stored as strings, duplicate keys become arrays.
   * @example
   * // ?foo=1 → { foo: '1' }
   * // ?tag=a&tag=b → { tag: ['a', 'b'] }
   */
  query: Record<string, string | string[]>;
  /** The matched route definition */
  matched: RouteDefinition | null;
  /** Hash fragment without # */
  hash: string;
};

/**
 * Route definition for configuration.
 */
export type RouteDefinition = {
  /** Path pattern (e.g., '/user/:id', '/posts/*') */
  path: string;
  /** Component loader (sync or async) */
  component: () => unknown | Promise<unknown>;
  /** Optional route name for programmatic navigation */
  name?: string;
  /** Optional metadata */
  meta?: Record<string, unknown>;
  /** Nested child routes */
  children?: RouteDefinition[];
};

/**
 * Router configuration options.
 */
export type RouterOptions = {
  /** Array of route definitions */
  routes: RouteDefinition[];
  /** Base path for all routes (default: '') */
  base?: string;
  /** Use hash-based routing instead of history (default: false) */
  hash?: boolean;
};

/**
 * Navigation guard function type.
 */
export type NavigationGuard = (to: Route, from: Route) => boolean | void | Promise<boolean | void>;

/**
 * Router instance returned by createRouter.
 */
export type Router = {
  /** Navigate to a path */
  push: (path: string) => Promise<void>;
  /** Replace current history entry */
  replace: (path: string) => Promise<void>;
  /** Go back in history */
  back: () => void;
  /** Go forward in history */
  forward: () => void;
  /** Go to a specific history entry */
  go: (delta: number) => void;
  /** Add a beforeEach guard */
  beforeEach: (guard: NavigationGuard) => () => void;
  /** Add an afterEach hook */
  afterEach: (hook: (to: Route, from: Route) => void) => () => void;
  /** Current route (reactive) */
  currentRoute: ReadonlySignal<Route>;
  /** All route definitions */
  routes: RouteDefinition[];
  /** Destroy the router and cleanup listeners */
  destroy: () => void;
};

// ============================================================================
// Internal State
// ============================================================================

/** @internal */
let activeRouter: Router | null = null;

/** @internal */
const routeSignal: Signal<Route> = signal<Route>({
  path: '',
  params: {},
  query: {},
  matched: null,
  hash: '',
});

/**
 * Reactive signal containing the current route.
 *
 * @example
 * ```ts
 * import { currentRoute } from 'bquery/router';
 * import { effect } from 'bquery/reactive';
 *
 * effect(() => {
 *   document.title = `Page: ${currentRoute.value.path}`;
 * });
 * ```
 */
export const currentRoute: ReadonlySignal<Route> = computed(() => routeSignal.value);

// ============================================================================
// Route Matching
// ============================================================================

/**
 * Converts a route path pattern to a RegExp for matching.
 * @internal
 */
const pathToRegex = (path: string): RegExp => {
  // Handle wildcard
  if (path === '*') {
    return /^.*$/;
  }

  // Replace :param with capture groups BEFORE escaping special chars
  // This ensures the colon is properly processed
  let pattern = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '(?<$1>[^/]+)');

  // Escape backslashes first (they're the escape character in regex)
  pattern = pattern.replace(/\\/g, '\\\\');

  // Escape forward slashes (the main special char in paths)
  pattern = pattern.replace(/\//g, '\\/');

  // Handle inline wildcards (e.g., /docs/*)
  pattern = pattern.replace(/\*/g, '.*');

  return new RegExp(`^${pattern}$`);
};

/**
 * Extracts param names from a route path.
 * @internal
 */
const extractParamNames = (path: string): string[] => {
  const matches = path.match(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
};

/**
 * Matches a path against route definitions and extracts params.
 * @internal
 */
const matchRoute = (
  path: string,
  routes: RouteDefinition[]
): { matched: RouteDefinition; params: Record<string, string> } | null => {
  for (const route of routes) {
    const regex = pathToRegex(route.path);
    const match = path.match(regex);

    if (match) {
      const paramNames = extractParamNames(route.path);
      const params: Record<string, string> = {};

      // Extract named groups if available
      if (match.groups) {
        Object.assign(params, match.groups);
      } else {
        // Fallback for browsers without named groups
        paramNames.forEach((name, index) => {
          params[name] = match[index + 1] || '';
        });
      }

      return { matched: route, params };
    }
  }

  return null;
};

/**
 * Parses query string into an object.
 * Single values are stored as strings, duplicate keys become arrays.
 * @internal
 *
 * @example
 * parseQuery('?foo=1') // { foo: '1' }
 * parseQuery('?tag=a&tag=b') // { tag: ['a', 'b'] }
 * parseQuery('?x=1&y=2&x=3') // { x: ['1', '3'], y: '2' }
 */
const parseQuery = (search: string): Record<string, string | string[]> => {
  const query: Record<string, string | string[]> = {};
  const params = new URLSearchParams(search);

  params.forEach((value, key) => {
    const existing = query[key];
    if (existing === undefined) {
      // First occurrence: store as string
      query[key] = value;
    } else if (Array.isArray(existing)) {
      // Already an array: append
      existing.push(value);
    } else {
      // Second occurrence: convert to array
      query[key] = [existing, value];
    }
  });

  return query;
};

/**
 * Creates a Route object from the current URL.
 * @internal
 */
const createRoute = (
  pathname: string,
  search: string,
  hash: string,
  routes: RouteDefinition[]
): Route => {
  const result = matchRoute(pathname, routes);

  return {
    path: pathname,
    params: result?.params ?? {},
    query: parseQuery(search),
    matched: result?.matched ?? null,
    hash: hash.replace(/^#/, ''),
  };
};

// ============================================================================
// Navigation
// ============================================================================

/**
 * Navigates to a new path.
 *
 * @param path - The path to navigate to
 * @param options - Navigation options
 *
 * @example
 * ```ts
 * import { navigate } from 'bquery/router';
 *
 * // Push to history
 * await navigate('/dashboard');
 *
 * // Replace current entry
 * await navigate('/login', { replace: true });
 * ```
 */
export const navigate = async (
  path: string,
  options: { replace?: boolean } = {}
): Promise<void> => {
  if (!activeRouter) {
    throw new Error('bQuery router: No router initialized. Call createRouter() first.');
  }

  await activeRouter[options.replace ? 'replace' : 'push'](path);
};

/**
 * Programmatically go back in history.
 *
 * @example
 * ```ts
 * import { back } from 'bquery/router';
 * back();
 * ```
 */
export const back = (): void => {
  if (activeRouter) {
    activeRouter.back();
  } else {
    history.back();
  }
};

/**
 * Programmatically go forward in history.
 *
 * @example
 * ```ts
 * import { forward } from 'bquery/router';
 * forward();
 * ```
 */
export const forward = (): void => {
  if (activeRouter) {
    activeRouter.forward();
  } else {
    history.forward();
  }
};

// ============================================================================
// Router Creation
// ============================================================================

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
 *     { path: '/user/:id', component: () => import('./pages/User') },
 *     { path: '*', component: () => import('./pages/NotFound') },
 *   ],
 *   base: '/app',
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
  if (activeRouter) {
    activeRouter.destroy();
  }

  const { routes, base = '', hash: useHash = false } = options;

  // Instance-specific guards and hooks (not shared globally)
  const beforeGuards: NavigationGuard[] = [];
  const afterHooks: Array<(to: Route, from: Route) => void> = [];

  // Flatten nested routes
  const flatRoutes = flattenRoutes(routes, base);

  /**
   * Gets the current path from the URL.
   */
  const getCurrentPath = (): { pathname: string; search: string; hash: string } => {
    if (useHash) {
      const hashPath = window.location.hash.slice(1) || '/';
      const [pathname, rest = ''] = hashPath.split('?');
      const [search, hashPart = ''] = rest.split('#');
      return {
        pathname,
        search: search ? `?${search}` : '',
        hash: hashPart ? `#${hashPart}` : '',
      };
    }

    let pathname = window.location.pathname;
    if (base && pathname.startsWith(base)) {
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
   * Performs navigation with guards.
   */
  const performNavigation = async (
    path: string,
    method: 'pushState' | 'replaceState'
  ): Promise<void> => {
    const { pathname, search, hash } = getCurrentPath();
    const from = createRoute(pathname, search, hash, flatRoutes);

    // Parse the target path
    const url = new URL(path, window.location.origin);
    const toPath = useHash ? path : url.pathname;
    const to = createRoute(toPath, url.search, url.hash, flatRoutes);

    // Run beforeEach guards
    for (const guard of beforeGuards) {
      const result = await guard(to, from);
      if (result === false) {
        return; // Cancel navigation
      }
    }

    // Update browser history
    const fullPath = useHash ? `#${path}` : `${base}${path}`;
    history[method]({}, '', fullPath);

    // Update route signal
    syncRoute();

    // Run afterEach hooks
    for (const hook of afterHooks) {
      hook(routeSignal.value, from);
    }
  };

  /**
   * Handle popstate events (back/forward).
   */
  const handlePopState = async (): Promise<void> => {
    const { pathname, search, hash } = getCurrentPath();
    const from = routeSignal.value;
    const to = createRoute(pathname, search, hash, flatRoutes);

    // Run beforeEach guards (supports async guards)
    for (const guard of beforeGuards) {
      const result = await guard(to, from);
      if (result === false) {
        // Restore previous state
        const restorePath = useHash ? `#${from.path}` : `${base}${from.path}`;
        history.pushState({}, '', restorePath);
        return;
      }
    }

    syncRoute();

    for (const hook of afterHooks) {
      hook(routeSignal.value, from);
    }
  };

  // Attach popstate listener
  window.addEventListener('popstate', handlePopState);

  // Initialize route
  syncRoute();

  const router: Router = {
    push: (path: string) => performNavigation(path, 'pushState'),
    replace: (path: string) => performNavigation(path, 'replaceState'),
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

    afterEach: (hook: (to: Route, from: Route) => void) => {
      afterHooks.push(hook);
      return () => {
        const index = afterHooks.indexOf(hook);
        if (index > -1) afterHooks.splice(index, 1);
      };
    },

    currentRoute,
    routes: flatRoutes,

    destroy: () => {
      window.removeEventListener('popstate', handlePopState);
      beforeGuards.length = 0;
      afterHooks.length = 0;
      activeRouter = null;
    },
  };

  activeRouter = router;
  return router;
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Flattens nested routes into a single array with full paths.
 * @internal
 */
const flattenRoutes = (routes: RouteDefinition[], base = ''): RouteDefinition[] => {
  const result: RouteDefinition[] = [];

  for (const route of routes) {
    const fullPath = route.path === '*' ? '*' : `${base}${route.path}`.replace(/\/+/g, '/');

    result.push({
      ...route,
      path: fullPath,
    });

    if (route.children) {
      result.push(...flattenRoutes(route.children, fullPath));
    }
  }

  return result;
};

/**
 * Resolves a route by name and params.
 *
 * @param name - The route name
 * @param params - Route params to interpolate
 * @returns The resolved path
 *
 * @example
 * ```ts
 * import { resolve } from 'bquery/router';
 *
 * const path = resolve('user', { id: '42' });
 * // Returns '/user/42' if route is defined as { name: 'user', path: '/user/:id' }
 * ```
 */
export const resolve = (name: string, params: Record<string, string> = {}): string => {
  if (!activeRouter) {
    throw new Error('bQuery router: No router initialized.');
  }

  const route = activeRouter.routes.find((r) => r.name === name);
  if (!route) {
    throw new Error(`bQuery router: Route "${name}" not found.`);
  }

  let path = route.path;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }

  return path;
};

/**
 * Checks if a path matches the current route.
 *
 * @param path - Path to check
 * @param exact - Whether to match exactly (default: false)
 * @returns True if the path matches
 *
 * @example
 * ```ts
 * import { isActive } from 'bquery/router';
 *
 * if (isActive('/dashboard')) {
 *   // Highlight nav item
 * }
 * ```
 */
export const isActive = (path: string, exact = false): boolean => {
  const current = routeSignal.value.path;
  return exact ? current === path : current.startsWith(path);
};

/**
 * Creates a computed signal that checks if a path is active.
 *
 * @param path - Path to check
 * @param exact - Whether to match exactly
 * @returns A reactive signal
 *
 * @example
 * ```ts
 * import { isActiveSignal } from 'bquery/router';
 * import { effect } from 'bquery/reactive';
 *
 * const dashboardActive = isActiveSignal('/dashboard');
 * effect(() => {
 *   navItem.classList.toggle('active', dashboardActive.value);
 * });
 * ```
 */
export const isActiveSignal = (path: string, exact = false): ReadonlySignal<boolean> => {
  return computed(() => {
    const current = routeSignal.value.path;
    return exact ? current === path : current.startsWith(path);
  });
};

// ============================================================================
// Router Link Helper
// ============================================================================

/**
 * Creates click handler for router links.
 * Attach to anchor elements to enable client-side navigation.
 *
 * @param path - Target path
 * @param options - Navigation options
 * @returns Click event handler
 *
 * @example
 * ```ts
 * import { link } from 'bquery/router';
 * import { $ } from 'bquery/core';
 *
 * $('#nav-home').on('click', link('/'));
 * $('#nav-about').on('click', link('/about'));
 * ```
 */
export const link = (path: string, options: { replace?: boolean } = {}): ((e: Event) => void) => {
  return (e: Event) => {
    e.preventDefault();
    navigate(path, options);
  };
};

/**
 * Intercepts all link clicks within a container for client-side routing.
 * Only intercepts links with matching origins and no target attribute.
 *
 * @param container - The container element to intercept links in
 * @returns Cleanup function to remove the listener
 *
 * @example
 * ```ts
 * import { interceptLinks } from 'bquery/router';
 *
 * // Intercept all links in the app
 * const cleanup = interceptLinks(document.body);
 *
 * // Later, remove the interceptor
 * cleanup();
 * ```
 */
export const interceptLinks = (container: Element = document.body): (() => void) => {
  const handler = (e: Event) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');

    if (!anchor) return;
    if (anchor.target) return; // Has target attribute
    if (anchor.hasAttribute('download')) return;
    if (anchor.origin !== window.location.origin) return; // External link

    const path = anchor.pathname + anchor.search + anchor.hash;

    e.preventDefault();
    navigate(path);
  };

  container.addEventListener('click', handler);
  return () => container.removeEventListener('click', handler);
};
