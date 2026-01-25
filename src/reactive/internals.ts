/**
 * Internal reactive plumbing shared across primitives.
 * @internal
 */

export type Observer = () => void;
export type CleanupFn = () => void;

const observerStack: Observer[] = [];
let batchDepth = 0;
const pendingObservers = new Set<Observer>();
let trackingEnabled = true;

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
