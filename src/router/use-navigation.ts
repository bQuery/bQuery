/**
 * Reactive navigation composable.
 * @module bquery/router
 *
 * @since 1.14.0
 */

import { computed, type ReadonlySignal } from '../reactive/index';
import { activeRouterState, isNavigating } from './state';
import type { NavigationResult, Route } from './types';

/**
 * Return type for {@link useNavigation}.
 *
 * @since 1.14.0
 */
export type UseNavigationReturn = {
  /**
   * Reactive boolean — `true` while any navigation is in progress.
   * Mirrors the module-level {@link isNavigating} signal.
   */
  isNavigating: ReadonlySignal<boolean>;
  /**
   * Reactive `NavigationResult | null` — the outcome of the most recent
   * navigation, or `null` if no navigation has occurred yet.
   *
   * Tied to `Router.lastNavigation`; falls back to `null` when no router
   * has been initialized.
   */
  lastNavigation: ReadonlySignal<NavigationResult | null>;
  /**
   * Reactive route the most recent navigation resolved to, or `null`.
   */
  to: ReadonlySignal<Route | null>;
  /**
   * Reactive route the most recent navigation departed from, or `null`.
   */
  from: ReadonlySignal<Route | null>;
  /**
   * Reactive error thrown by the most recent navigation, or `null`.
   */
  error: ReadonlySignal<unknown | null>;
  /**
   * Reactive status string of the most recent navigation, or `null`
   * if no navigation has occurred yet.
   */
  status: ReadonlySignal<NavigationResult['status'] | null>;
};

/**
 * Reactive composable that exposes router navigation state — useful for
 * implementing progress bars, error toasts, and navigation-blocking UI.
 *
 * All returned signals are recomputed when the active router changes or when
 * that router's `lastNavigation` signal updates, so they remain consistent
 * even if `useNavigation()` runs before `createRouter()` or the active router
 * is later replaced.
 *
 * @returns Reactive navigation handles.
 *
 * @since 1.14.0
 *
 * @example
 * ```ts
 * import { useNavigation } from '@bquery/bquery/router';
 * import { effect } from '@bquery/bquery/reactive';
 *
 * const { isNavigating, status, error } = useNavigation();
 *
 * effect(() => {
 *   document.body.toggleAttribute('data-loading', isNavigating.value);
 * });
 *
 * effect(() => {
 *   if (status.value === 'error') {
 *     console.error('Navigation failed', error.value);
 *   }
 * });
 * ```
 */
const lastNavigation = computed<NavigationResult | null>(() => {
  const router = activeRouterState.value;
  return router ? router.lastNavigation.value : null;
});
const to = computed<Route | null>(() => lastNavigation.value?.to ?? null);
const from = computed<Route | null>(() => lastNavigation.value?.from ?? null);
const error = computed<unknown | null>(() => lastNavigation.value?.error ?? null);
const status = computed<NavigationResult['status'] | null>(
  () => lastNavigation.value?.status ?? null
);

const navigationHandle: UseNavigationReturn = {
  isNavigating,
  lastNavigation,
  to,
  from,
  error,
  status,
};

export const useNavigation = (): UseNavigationReturn => {
  return navigationHandle;
};
