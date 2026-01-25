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
  const existingRouter = getActiveRouter();
  if (existingRouter) {
    existingRouter.destroy();
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
      setActiveRouter(null);
    },
  };

  setActiveRouter(router);
  return router;
};
