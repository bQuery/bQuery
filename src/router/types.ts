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
 * Outcome of a navigation attempt. Returned by the additive
 * {@link Router.pushResult} / {@link Router.replaceResult} methods and
 * exposed via {@link Router.lastNavigation}.
 *
 * @example
 * ```ts
 * const result = await router.pushResult('/dashboard');
 * if (result.status === 'completed') {
 *   console.log('Navigated to', result.to?.path);
 * }
 * ```
 */
export type NavigationResult = {
  /**
   * The high-level outcome of the navigation attempt:
   * - `'completed'` — navigation finished and the URL was updated.
   * - `'canceled'` — a guard returned `false`.
   * - `'redirected'` — the navigation triggered a `redirectTo` chain;
   *   `to` reflects the final route.
   * - `'error'` — a guard, loader, or commit threw.
   */
  status: 'completed' | 'canceled' | 'redirected' | 'error';
  /** The originally requested path. */
  requestedPath: string;
  /** Route the navigation resolved to, when applicable. */
  to?: Route;
  /** Route the navigation departed from, when applicable. */
  from?: Route;
  /** Error thrown during navigation, if `status` is `'error'`. */
  error?: unknown;
};

/**
 * Input accepted by {@link Router.resolveRoute}. Either a raw path string
 * or a named-route object with optional params/query/hash.
 */
export type ResolveRouteInput =
  | string
  | {
      /** Path string (overrides `name` when both are provided). */
      path?: string;
      /** Route name (matched against `RouteDefinition.name`). */
      name?: string;
      /** Route params for `:param` substitution. */
      params?: Record<string, string>;
      /** Query parameters. Array values produce repeated keys. */
      query?: Record<string, string | number | boolean | Array<string | number | boolean>>;
      /** Hash fragment (with or without leading `#`). */
      hash?: string;
    };

/**
 * Result of {@link Router.resolveRoute}.
 */
export type ResolvedRouteInfo = {
  /** Path-only string, including query and hash if present. */
  path: string;
  /** Full href, including the router base. */
  href: string;
  /** Matched route definition or `null`. */
  matched: RouteDefinition | null;
};

/**
 * Router instance returned by createRouter.
 */
export type Router = {
  /** Navigate to a path */
  push: (path: string) => Promise<void>;
  /** Replace current history entry */
  replace: (path: string) => Promise<void>;
  /**
   * Navigate to a path and return a structured result describing the outcome.
   * Companion to {@link Router.push} that returns structured cancellation and
   * error outcomes instead of throwing.
   *
   * @since 1.14.0
   */
  pushResult: (path: string) => Promise<NavigationResult>;
  /**
   * Replace the current history entry and return a structured result.
   * Companion to {@link Router.replace} that returns structured cancellation
   * and error outcomes instead of throwing.
   *
   * @since 1.14.0
   */
  replaceResult: (path: string) => Promise<NavigationResult>;
  /** Go back in history */
  back: () => void;
  /** Go forward in history */
  forward: () => void;
  /** Go to a specific history entry */
  go: (delta: number) => void;
  /** Add a beforeEach guard */
  beforeEach: (guard: NavigationGuard) => () => void;
  /**
   * Add a beforeResolve guard. These run after all `beforeEach` and
   * route-level `beforeEnter` guards, but before the navigation is committed
   * to history. Useful for cancelling navigation based on async work that
   * should only be triggered if no earlier guard objected.
   *
   * Returns an unsubscribe function.
   *
   * @since 1.14.0
   */
  beforeResolve: (guard: NavigationGuard) => () => void;
  /** Add an afterEach hook */
  afterEach: (hook: (to: Route, from: Route) => void) => () => void;
  /**
   * Resolve a path string or named-route descriptor to its full `path`/`href`
   * and matched definition without performing navigation.
   *
   * @since 1.14.0
   */
  resolveRoute: (input: ResolveRouteInput) => ResolvedRouteInfo;
  /**
   * Returns `true` if a route with the given `name` exists.
   *
   * @since 1.14.0
   */
  hasRoute: (name: string) => boolean;
  /**
   * Add a route at runtime. If `parentName` is provided, the route is added as
   * a child of the named parent (its path is prefixed). Otherwise the route is
   * appended at the top level. Existing routes with the same `name` are
   * replaced.
   *
   * @since 1.14.0
   */
  addRoute: (parentName: string | undefined, route: RouteDefinition) => void;
  /**
   * Remove a named route (and any matching children).
   * Returns `true` if a route was removed.
   *
   * @since 1.14.0
   */
  removeRoute: (name: string) => boolean;
  /**
   * Returns a promise that resolves after the router has finished its initial
   * synchronization. If the router is already idle, resolves immediately.
   * Useful for SSR hydration and end-to-end tests.
   *
   * @since 1.14.0
   */
  isReady: () => Promise<void>;
  /**
   * Reactive signal containing the outcome of the most recent navigation, or
   * `null` if no navigation has occurred via this router yet.
   *
   * @since 1.14.0
   */
  lastNavigation: ReadonlySignal<NavigationResult | null>;
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
