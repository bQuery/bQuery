/**
 * Minimal SPA router with History API integration.
 *
 * This module provides a lightweight, signal-based router for single-page
 * applications. Features include:
 * - History API navigation
 * - Route matching with params, wildcards, and regex constraints
 * - Lazy route loading
 * - Navigation guards (beforeEach, afterEach, per-route beforeEnter)
 * - Reactive current route via signals
 * - `useRoute()` composable for fine-grained reactive access
 * - Route redirects via `redirectTo`
 * - Scroll position restoration on back/forward
 * - Multi-value query params (e.g., `?tag=a&tag=b` → `{ tag: ['a', 'b'] }`)
 *
 * @module bquery/router
 *
 * @example
 * ```ts
 * import { createRouter, navigate, currentRoute, useRoute } from '@bquery/bquery/router';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const router = createRouter({
 *   routes: [
 *     { path: '/', component: () => import('./Home') },
 *     { path: '/user/:id(\\d+)', component: () => import('./User') },
 *     { path: '/old', redirectTo: '/new' },
 *     { path: '*', component: () => import('./NotFound') },
 *   ],
 *   scrollRestoration: true,
 * });
 *
 * const { path, params } = useRoute();
 * effect(() => {
 *   console.log('Route changed:', path.value, params.value);
 * });
 *
 * navigate('/user/42');
 * ```
 */

export { BqLinkElement, registerBqLink } from './bq-link';
export { interceptLinks, link } from './links';
export { back, forward, navigate } from './navigation';
export { createRouter } from './router';
export { currentRoute, isNavigating } from './state';
export type { NavigationGuard, Route, RouteDefinition, Router, RouterOptions } from './types';
export { useRoute, type UseRouteReturn } from './use-route';
export { isActive, isActiveSignal, resolve } from './utils';
