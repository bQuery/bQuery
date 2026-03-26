/**
 * Router creation and lifecycle management.
 * @module bquery/router
 */

import { createRoute } from './match';
import { currentRoute, getActiveRouter, routeSignal, setActiveRouter } from './state';
import type { NavigationGuard, Route, Router, RouterOptions } from './types';
import { flattenRoutes } from './utils';

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
  const afterHooks: Array<(to: Route, from: Route) => void> = [];

  // Flatten nested routes (base-relative, not including the base path)
  const flatRoutes = flattenRoutes(routes);

  // Scroll position storage keyed by history state id
  const scrollPositions = new Map<string, { x: number; y: number }>();
  let currentScrollKey = '0';

  // Enable manual scroll restoration if scrollRestoration is configured
  if (scrollRestoration && typeof history !== 'undefined' && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  /**
   * Generates a unique key for the current history entry.
   * @internal
   */
  const getScrollKey = (): string => {
    return (history.state && history.state.__bqScrollKey) || currentScrollKey;
  };

  /**
   * Saves current scroll position for the current history entry.
   * @internal
   */
  const saveScrollPosition = (): void => {
    if (!scrollRestoration) return;
    const key = getScrollKey();
    scrollPositions.set(key, { x: window.scrollX, y: window.scrollY });
  };

  /**
   * Restores scroll position for the current history entry.
   * @internal
   */
  const restoreScrollPosition = (): void => {
    if (!scrollRestoration) return;
    const key = getScrollKey();
    const pos = scrollPositions.get(key);
    if (pos) {
      window.scrollTo(pos.x, pos.y);
    } else {
      window.scrollTo(0, 0);
    }
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
    const to = createRoute(url.pathname, url.search, url.hash, flatRoutes);

    // Check for redirectTo on the matched route
    if (to.matched?.redirectTo) {
      // Navigate to the redirect target instead
      await performNavigation(to.matched.redirectTo, method);
      return;
    }

    // Run route-level beforeEnter guard
    if (to.matched?.beforeEnter) {
      const result = await to.matched.beforeEnter(to, from);
      if (result === false) {
        return; // Cancel navigation
      }
    }

    // Run beforeEach guards
    for (const guard of beforeGuards) {
      const result = await guard(to, from);
      if (result === false) {
        return; // Cancel navigation
      }
    }

    // Save scroll position before navigation
    saveScrollPosition();

    // Update browser history
    const scrollKey = String(Date.now());
    const fullPath = useHash ? `#${path}` : `${base}${path}`;
    const state = scrollRestoration ? { __bqScrollKey: scrollKey } : {};
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
  };

  /**
   * Handle popstate events (back/forward).
   */
  const handlePopState = async (): Promise<void> => {
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
        history.replaceState({}, '', restorePath);
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
        history.replaceState({}, '', restorePath);
        return;
      }
    }

    // Save scroll position of the page we're leaving
    saveScrollPosition();

    // Update scroll key from history state
    currentScrollKey = getScrollKey();

    syncRoute();

    // Restore scroll position for the entry we're navigating to
    restoreScrollPosition();

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
    base,
    hash: useHash,

    destroy: () => {
      window.removeEventListener('popstate', handlePopState);
      beforeGuards.length = 0;
      afterHooks.length = 0;
      scrollPositions.clear();
      // Restore auto scroll restoration on destroy
      if (scrollRestoration && typeof history !== 'undefined' && 'scrollRestoration' in history) {
        history.scrollRestoration = 'auto';
      }
      setActiveRouter(null);
    },
  };

  setActiveRouter(router);
  return router;
};
