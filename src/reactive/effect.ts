/**
 * Reactive effects.
 */

import { CleanupFn, Observer, track, clearDependencies } from './internals';

/**
 * Creates a side effect that automatically re-runs when dependencies change.
 *
 * The effect runs immediately upon creation and then re-runs whenever
 * any signal or computed value read inside it changes.
 *
 * @param fn - The effect function to run
 * @returns A cleanup function to stop the effect
 */
export const effect = (fn: () => void | CleanupFn): CleanupFn => {
  let cleanupFn: CleanupFn | void;
  let isDisposed = false;

  const observer: Observer = () => {
    if (isDisposed) return;

    if (cleanupFn) {
      cleanupFn();
    }

    // Clear old dependencies before running to avoid stale subscriptions
    clearDependencies(observer);

    cleanupFn = track(observer, fn);
  };

  observer();

  return () => {
    isDisposed = true;
    if (cleanupFn) {
      cleanupFn();
    }
    // Clean up all dependencies when effect is disposed
    clearDependencies(observer);
  };
};
