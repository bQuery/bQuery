/**
 * Reactive effects.
 */

import { CleanupFn, Observer, track, clearDependencies } from './internals';
import { getActiveScope, hasScopeDisposer } from './scope';

/**
 * Creates a side effect that automatically re-runs when dependencies change.
 *
 * The effect runs immediately upon creation and then re-runs whenever
 * any signal or computed value read inside it changes.
 *
 * If created inside an {@link effectScope}, the effect is automatically
 * collected and will be disposed when the scope stops.
 *
 * @param fn - The effect function to run
 * @returns A cleanup function to stop the effect
 */
export const effect = (fn: () => void | CleanupFn): CleanupFn => {
  let cleanupFn: CleanupFn | void;
  let isDisposed = false;
  const scope = getActiveScope();

  const runCleanup = (): void => {
    if (cleanupFn) {
      try {
        cleanupFn();
      } catch (error) {
        console.error('bQuery reactive: Error in effect cleanup', error);
      }
      cleanupFn = undefined;
    }
  };

  const clearEffectState = (): void => {
    runCleanup();
    // Clean up all dependencies when effect is disposed
    clearDependencies(observer);
  };

  const dispose: CleanupFn = () => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    clearEffectState();
  };

  if (hasScopeDisposer(scope)) {
    scope._addDisposer(dispose);
  }

  const observer: Observer = () => {
    if (isDisposed) return;

    runCleanup();

    // Clear old dependencies before running to avoid stale subscriptions
    clearDependencies(observer);

    try {
      cleanupFn = track(observer, fn);
    } catch (error) {
      console.error('bQuery reactive: Error in effect', error);
    }

    if (isDisposed) {
      clearEffectState();
    }
  };

  observer();

  return dispose;
};
