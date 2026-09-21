/**
 * Internal reactive plumbing shared across primitives.
 * @internal
 */

import { getScheduler, setPendingDrain } from './config';

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

/**
 * Observers that recompute a derived value (a `Computed`'s revalidate) rather
 * than producing a side effect. The flush drains these to a fixed point before
 * running any effect, so an effect never pulls from a computed that has not
 * caught up — the `a → double → quadruple` case, where an effect reading both
 * would otherwise see a fresh `double` beside a stale `quadruple` (#210).
 */
const derivations = new WeakSet<Observer>();

/**
 * Mark an observer as a derivation, so the flush orders it ahead of effects.
 * @internal
 */
export const markDerivation = (observer: Observer): void => {
  derivations.add(observer);
};

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

/**
 * Whether a microtask flush is already queued, so a burst of writes in one
 * tick schedules exactly one.
 */
let flushQueued = false;

/**
 * Queue the auto-batch flush. Uses a microtask so everything written in the
 * current synchronous run coalesces into one flush, which is what makes the
 * `'batched'` scheduler glitch-free: every dirty computed in a diamond is
 * marked before any effect pulls a value.
 */
const queueFlush = (): void => {
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    flushQueued = false;
    // Flush through the batch machinery rather than calling `flushObservers`
    // directly, so writes performed *by* observers keep coalescing into this
    // same flush. When an explicit batch opened in the meantime, this nests
    // inside it and the outer `endBatch` does the flushing instead.
    beginBatch();
    endBatch();
  });
};

export const scheduleObserver = (observer: Observer): void => {
  if (batchDepth > 0) {
    pendingObservers.add(observer);
    return;
  }
  if (getScheduler() === 'batched') {
    pendingObservers.add(observer);
    queueFlush();
    return;
  }
  observer();
};

/**
 * Run any pending observers now instead of waiting for the microtask.
 *
 * Needed by tests and by code that depends on the synchronous timing the
 * `'sync'` scheduler gives. A no-op when nothing is queued, and safe to call
 * inside a batch — the work then stays with the enclosing batch.
 * @internal
 */
export const flushSyncInternal = (): void => {
  beginBatch();
  endBatch();
};

// So `configureReactive` can deliver queued work before the scheduler
// changes under it, without importing this module (that would cycle).
setPendingDrain(flushSyncInternal);

/**
 * Upper bound on flush passes. Observers re-queued during a flush are drained
 * in follow-up passes so transitive updates stay batched; a cyclic update
 * between observers would otherwise never settle. Mirrors MAX_SYNC_RERUNS in
 * effect.ts.
 */
const MAX_FLUSH_PASSES = 100;

let isFlushing = false;

/**
 * Whether a flush is running right now — i.e. whether the caller is inside
 * an observer. `flushSyncInternal` cannot do anything in that case, so the
 * public wrapper warns instead of silently doing nothing.
 * @internal
 */
export const isFlushingNow = (): boolean => isFlushing;

/** Remove and return the pending observers matching `predicate`. */
const takePending = (predicate: (observer: Observer) => boolean): Observer[] => {
  const taken: Observer[] = [];
  for (const observer of pendingObservers) {
    if (predicate(observer)) taken.push(observer);
  }
  for (const observer of taken) pendingObservers.delete(observer);
  return taken;
};

const runObservers = (observers: Observer[]): void => {
  for (const observer of observers) {
    try {
      observer();
    } catch (error) {
      console.error('bQuery reactive: Error in observer during batch flush', error);
    }
  }
};

const warnUnsettled = (): void => {
  console.warn(
    'bQuery reactive: batch flush did not settle (cyclic update between observers?); remaining updates were skipped'
  );
};

const flushObservers = (): void => {
  if (isFlushing) return;
  isFlushing = true;
  let passes = 0;
  try {
    while (pendingObservers.size > 0) {
      if (++passes > MAX_FLUSH_PASSES) {
        pendingObservers.clear();
        warnUnsettled();
        break;
      }

      // Derivations first, to a fixed point. Recomputing one can dirty
      // another further down the graph, and every one of them has to settle
      // before an effect reads anything — otherwise the effect observes a
      // half-updated graph, which is the glitch this ordering exists to stop.
      let derivationPasses = 0;
      let pendingDerivations = takePending((observer) => derivations.has(observer));
      while (pendingDerivations.length > 0) {
        if (++derivationPasses > MAX_FLUSH_PASSES) {
          // Abort the whole flush, as the outer guard does for the same
          // situation. Breaking out of the inner loop instead dropped the
          // taken derivations unrun *and* fell through to the effect phase,
          // running effects against a knowingly half-settled graph — the
          // exact glitch this ordering exists to prevent. It also let one
          // flush do up to MAX_FLUSH_PASSES² observer runs and emit a
          // warning per outer pass, because `derivationPasses` resets each
          // time round.
          pendingObservers.clear();
          warnUnsettled();
          return;
        }
        runObservers(pendingDerivations);
        pendingDerivations = takePending((observer) => derivations.has(observer));
      }

      // The graph is settled; now the side effects.
      runObservers(takePending(() => true));
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
