/**
 * Internal router state (active router and current route signal).
 * @module bquery/router
 */

import { computed, readonly, signal, type ReadonlySignal, type Signal } from '../reactive/index';
import type { Route, Router } from './types';

// ============================================================================
// Internal State
// ============================================================================

/** @internal */
let activeRouter: Router | null = null;

/** @internal */
export const routeSignal: Signal<Route> = signal<Route>({
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
 * import { currentRoute } from '@bquery/bquery/router';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * effect(() => {
 *   document.title = `Page: ${currentRoute.value.path}`;
 * });
 * ```
 */
export const currentRoute: ReadonlySignal<Route> = computed(() => routeSignal.value);

/** @internal */
const navigationCountSignal: Signal<number> = signal(0);

/** @internal */
const isNavigatingSignal: Signal<boolean> = signal(false);

/**
 * Reactive signal indicating whether a navigation is currently in progress.
 *
 * This becomes `true` while async guards or redirect resolution are running,
 * then flips back to `false` once navigation finishes or is canceled.
 *
 * @example
 * ```ts
 * import { isNavigating } from '@bquery/bquery/router';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * effect(() => {
 *   document.body.toggleAttribute('data-loading-route', isNavigating.value);
 * });
 * ```
 */
export const isNavigating: ReadonlySignal<boolean> = readonly(isNavigatingSignal);

/** @internal */
export const beginNavigation = (): void => {
  if (navigationCountSignal.value === 0) {
    isNavigatingSignal.value = true;
  }
  navigationCountSignal.value += 1;
};

/** @internal */
export const endNavigation = (): void => {
  const nextCount = Math.max(0, navigationCountSignal.value - 1);
  navigationCountSignal.value = nextCount;

  if (nextCount === 0) {
    isNavigatingSignal.value = false;
  }
};

/** @internal */
export const resetNavigationState = (): void => {
  navigationCountSignal.value = 0;
  isNavigatingSignal.value = false;
};

/** @internal */
export const getActiveRouter = (): Router | null => activeRouter;

/** @internal */
export const setActiveRouter = (router: Router | null): void => {
  activeRouter = router;
};
