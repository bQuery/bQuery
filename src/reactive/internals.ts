/**
 * Internal reactive plumbing shared across primitives.
 * @internal
 */

export type Observer = () => void;
export type CleanupFn = () => void;

/**
 * Interface for reactive sources (Signals, Computed) that can unsubscribe observers.
 * @internal
 */
export interface ReactiveSource {
  unsubscribe(observer: Observer): void;
}

const observerStack: Observer[] = [];
let batchDepth = 0;
const pendingObservers = new Set<Observer>();

// Track dependencies for each observer to enable cleanup
const observerDependencies = new WeakMap<Observer, Set<ReactiveSource>>();

export const track = <T>(observer: Observer, fn: () => T): T => {
  observerStack.push(observer);
  try {
    return fn();
  } finally {
    observerStack.pop();
  }
};

export const getCurrentObserver = (): Observer | undefined =>
  observerStack[observerStack.length - 1];

/**
 * Executes a function without exposing the current observer to dependencies.
 * Unlike disabling tracking globally, this still allows nested reactive internals
 * (e.g., computed recomputation) to track their own dependencies.
 * @internal
 */
export const withoutCurrentObserver = <T>(fn: () => T): T => {
  // Push undefined to temporarily "hide" the current observer
  // This way, Signal.value reads won't link to the previous observer,
  // but nested track() calls (e.g., computed recompute) still work normally.
  observerStack.push(undefined as unknown as Observer);
  try {
    return fn();
  } finally {
    observerStack.pop();
  }
};

export const scheduleObserver = (observer: Observer): void => {
  if (batchDepth > 0) {
    pendingObservers.add(observer);
    return;
  }
  observer();
};

/**
 * Upper bound on flush passes. Observers re-queued during a flush are drained
 * in follow-up passes so transitive updates stay batched; a cyclic update
 * between observers would otherwise never settle. Mirrors MAX_SYNC_RERUNS in
 * effect.ts.
 */
const MAX_FLUSH_PASSES = 100;

let isFlushing = false;

const flushObservers = (): void => {
  if (isFlushing) return;
  isFlushing = true;
  let passes = 0;
  try {
    while (pendingObservers.size > 0) {
      if (++passes > MAX_FLUSH_PASSES) {
        pendingObservers.clear();
        console.warn(
          'bQuery reactive: batch flush did not settle (cyclic update between observers?); remaining updates were skipped'
        );
        break;
      }
      const snapshot = Array.from(pendingObservers);
      pendingObservers.clear();
      for (const observer of snapshot) {
        try {
          observer();
        } catch (error) {
          console.error('bQuery reactive: Error in observer during batch flush', error);
        }
      }
    }
  } finally {
    isFlushing = false;
  }
};

export const beginBatch = (): void => {
  batchDepth += 1;
};

export const endBatch = (): void => {
  if (batchDepth <= 0) return;
  if (batchDepth === 1) {
    // Keep the batch open while flushing so writes performed by observers
    // keep coalescing into this same flush instead of dispatching one by one.
    try {
      flushObservers();
    } finally {
      batchDepth = 0;
    }
    return;
  }
  batchDepth -= 1;
};

/**
 * Registers a dependency between an observer and a reactive source.
 * @internal
 */
export const registerDependency = (observer: Observer, source: ReactiveSource): void => {
  let deps = observerDependencies.get(observer);
  if (!deps) {
    deps = new Set();
    observerDependencies.set(observer, deps);
  }
  deps.add(source);
};

/**
 * Removes a specific source from an observer's dependency set.
 * Used when a source (e.g. Signal) is disposed to prevent stale references.
 * @internal
 */
export const removeDependency = (observer: Observer, source: ReactiveSource): void => {
  const deps = observerDependencies.get(observer);
  if (deps) {
    deps.delete(source);
  }
};

/**
 * Clears all dependencies for an observer, unsubscribing from all sources.
 * @internal
 */
export const clearDependencies = (observer: Observer): void => {
  const deps = observerDependencies.get(observer);
  if (deps) {
    for (const source of deps) {
      source.unsubscribe(observer);
    }
    deps.clear();
  }
};
