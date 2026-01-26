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
let trackingEnabled = true;

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

export const scheduleObserver = (observer: Observer): void => {
  if (batchDepth > 0) {
    pendingObservers.add(observer);
    return;
  }
  observer();
};

const flushObservers = (): void => {
  for (const observer of Array.from(pendingObservers)) {
    pendingObservers.delete(observer);
    observer();
  }
};

export const beginBatch = (): void => {
  batchDepth += 1;
};

export const endBatch = (): void => {
  batchDepth -= 1;
  if (batchDepth === 0) {
    flushObservers();
  }
};

export const isTrackingEnabled = (): boolean => trackingEnabled;

export const setTrackingEnabled = (value: boolean): void => {
  trackingEnabled = value;
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
