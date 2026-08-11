/**
 * Reactive effects.
 */

import { CleanupFn, Observer, track, clearDependencies } from './internals';
import { getActiveScope, hasScopeDisposer } from './scope';

export interface EffectInspectionSnapshot {
  readonly label?: string;
  readonly runs: number;
  readonly disposed: boolean;
}

interface EffectInspectionRecord {
  label?: string;
  runs: number;
  disposed: boolean;
}

const trackedEffects = new Map<symbol, EffectInspectionRecord>();
let effectInspectionEnabled = false;

/**
 * Upper bound on synchronous self-triggered re-runs of a single effect.
 * Effects that legitimately write their own dependencies settle within a few
 * iterations; anything hitting this bound is a cyclic update.
 */
const MAX_SYNC_RERUNS = 100;

/** @internal */
export const __inspectTrackedEffects = (): EffectInspectionSnapshot[] => {
  return [...trackedEffects.values()].map((record) => ({ ...record }));
};

/** @internal */
export const __setEffectInspectionEnabled = (enabled: boolean): void => {
  effectInspectionEnabled = enabled;
  if (!enabled) trackedEffects.clear();
};

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
  // Allocated lazily: inspection is a dev feature, effects are created per binding.
  let effectId: symbol | null = null;

  if (effectInspectionEnabled) {
    effectId = Symbol('bquery.effect');
    trackedEffects.set(effectId, { runs: 0, disposed: false });
  }

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
    if (effectId) trackedEffects.delete(effectId);
    clearEffectState();
  };

  if (hasScopeDisposer(scope)) {
    scope._addDisposer(dispose);
  }

  const runEffect = (): void => {
    if (effectInspectionEnabled) {
      effectId ??= Symbol('bquery.effect');
      const record = trackedEffects.get(effectId);
      if (record) {
        record.runs += 1;
        record.disposed = false;
      } else {
        trackedEffects.set(effectId, { runs: 1, disposed: false });
      }
    }

    runCleanup();

    // Clear old dependencies before running to avoid stale subscriptions
    clearDependencies(observer);

    try {
      cleanupFn = track(observer, fn);
    } catch (error) {
      console.error('bQuery reactive: Error in effect', error);
    }
  };

  let isRunning = false;
  let reRunRequested = false;

  const observer: Observer = () => {
    if (isDisposed) return;

    // An effect that writes a signal it also reads re-triggers itself while
    // still executing. Recursing synchronously would overflow the stack, so
    // defer the re-run to a bounded loop and warn if it never settles.
    if (isRunning) {
      reRunRequested = true;
      return;
    }

    isRunning = true;
    try {
      let runs = 0;
      do {
        reRunRequested = false;
        runEffect();
        runs += 1;
      } while (reRunRequested && !isDisposed && runs < MAX_SYNC_RERUNS);

      if (reRunRequested && !isDisposed) {
        console.warn(
          'bQuery reactive: cyclic effect update detected (effect keeps re-triggering itself); further re-runs were skipped'
        );
      }
    } finally {
      isRunning = false;
      if (isDisposed) {
        clearEffectState();
      }
    }
  };

  observer();

  return dispose;
};
