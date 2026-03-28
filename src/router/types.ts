/**
 * Router types and public contracts.
 * @module bquery/router
 */

import type { ReadonlySignal } from '../reactive/index';

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
   * Each key maps to a single string value by default.
   * Only keys that appear multiple times in the query string become arrays.
   * @example
   * // ?foo=1 → { foo: '1' }
   * // ?tag=a&tag=b → { tag: ['a', 'b'] }
   * // ?x=1&y=2&x=3 → { x: ['1', '3'], y: '2' }
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
type BaseRouteDefinition = {
  /**
   * Path pattern (e.g., '/user/:id', '/posts/*').
   * Supports regex constraints on params: `/user/:id(\\d+)`.
   * Constraint backreferences are not supported.
   */
  path: string;
  /** Optional route name for programmatic navigation */
  name?: string;
  /** Optional metadata */
  meta?: Record<string, unknown>;
  /** Nested child routes */
  children?: RouteDefinition[];
  /**
   * Per-route navigation guard. Called before entering this route.
   * Return `false` to cancel navigation.
   *
   * @example
   * ```ts
   * {
   *   path: '/admin',
   *   component: () => import('./Admin'),
   *   beforeEnter: (to, from) => isAuthenticated() || false,
   * }
   * ```
   */
  beforeEnter?: NavigationGuard;
};

type ComponentRouteDefinition = BaseRouteDefinition & {
  /** Component loader (sync or async) */
  component: () => unknown | Promise<unknown>;
  redirectTo?: never;
};

type RedirectRouteDefinition = BaseRouteDefinition & {
  /**
   * Redirect target path. When the route is matched, the router
   * automatically navigates to this path instead.
   *
   * @example
   * ```ts
   * { path: '/old-page', redirectTo: '/new-page' }
   * ```
   */
  redirectTo: string;
  component?: never;
  children?: never;
  beforeEnter?: never;
};

export type RouteDefinition = ComponentRouteDefinition | RedirectRouteDefinition;

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
  /**
   * Restore scroll position on back/forward navigation (default: false).
   * When enabled, the router saves scroll positions for each history entry
   * and restores them on popstate events.
   */
  scrollRestoration?: boolean;
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
  /** Base path for all routes */
  base: string;
  /** Whether hash-based routing is enabled */
  hash: boolean;
  /** Destroy the router and cleanup listeners */
  destroy: () => void;
};
