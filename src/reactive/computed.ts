/**
 * Computed reactive values.
 */

import {
  clearDependencies,
  getCurrentObserver,
  registerDependency,
  scheduleObserver,
  track,
  withoutCurrentObserver,
  type ReactiveSource,
} from './internals';
import { getActiveScope, hasScopeDisposer } from './scope';

/**
 * A computed value that derives from other reactive sources.
 *
 * Computed values are lazily evaluated and cached. They only
 * recompute when their dependencies change.
 *
 * @template T - The type of the computed value
 */
export class Computed<T> implements ReactiveSource {
  private cachedValue!: T;
  private hasCachedValue = false;
  private dirty = true;
  private disposed = false;
  private subscribers = new Set<() => void>();
  /** Value the subscribers were last notified about (or first observed). */
  private lastNotifiedValue!: T;
  private hasNotifiedValue = false;
  /**
   * Set when a subscriber observed a value the set as a whole was never
   * notified about, which makes {@link lastNotifiedValue} unusable as a
   * skip-notification baseline until the next full notification.
   */
  private notifiedValueStale = false;

  private readonly markDirty = () => {
    if (this.disposed) {
      return;
    }
    this.dirty = true;
    if (this.subscribers.size === 0) return;
    // Re-validate before waking subscribers: if the recomputed value is
    // unchanged, downstream observers are not notified at all.
    //
    // Scheduled unconditionally — an already-dirty computed is not proof that a
    // revalidate is still queued: a compute that threw restores `dirty` without
    // one, and a batch that exceeds its flush passes drops queued observers.
    // Re-scheduling is free (the pending-observer set deduplicates inside a
    // batch) and `revalidate` short-circuits when nothing actually changed.
    scheduleObserver(this.revalidate);
  };

  private readonly revalidate = () => {
    if (this.disposed || this.subscribers.size === 0) return;
    if (this.dirty) {
      try {
        this.recompute();
      } catch {
        // Wake subscribers so their own reads surface the compute error
        // in their context, matching pre-revalidation behavior.
        this.notifySubscribers();
        return;
      }
    }
    if (
      this.hasNotifiedValue &&
      !this.notifiedValueStale &&
      Object.is(this.cachedValue, this.lastNotifiedValue)
    ) {
      return;
    }
    this.captureNotifiedValue();
    this.notifySubscribers();
  };

  /**
   * Creates a new computed value.
   * @param compute - Function that computes the value
   */
  constructor(private readonly compute: () => T) {}

  private recompute(): void {
    // Cleared before running so re-entrant reads see the cached value
    // instead of recursing; restored on failure so the next read retries.
    this.dirty = false;
    clearDependencies(this.markDirty);
    try {
      this.cachedValue = track(this.markDirty, this.compute);
      this.hasCachedValue = true;
    } catch (error) {
      this.dirty = true;
      throw error;
    }
  }

  private ensureDisposedValue(): T {
    if (!this.hasCachedValue) {
      this.cachedValue = withoutCurrentObserver(() => this.compute());
      this.hasCachedValue = true;
    }
    return this.cachedValue;
  }

  /** Rebases the skip-notification baseline onto the current value. */
  private captureNotifiedValue(): void {
    this.hasNotifiedValue = true;
    this.notifiedValueStale = false;
    this.lastNotifiedValue = this.cachedValue;
  }

  /**
   * Keeps the baseline aligned with what the current subscribers have actually
   * seen. Called after a tracked read.
   *
   * @param hadSubscribers - Whether the subscriber set was non-empty before the read
   */
  private syncNotifiedValue(hadSubscribers: boolean): void {
    if (!hadSubscribers || !this.hasNotifiedValue) {
      // Nothing has been observed yet, or the set was empty and is being
      // repopulated: the reader that just subscribed is in sync with the value
      // it read. Rebasing here keeps a subscriber from a later generation from
      // inheriting the baseline of an earlier one — otherwise a change made
      // while nobody was subscribed, followed by a revert, would be skipped.
      this.captureNotifiedValue();
      return;
    }
    if (!Object.is(this.cachedValue, this.lastNotifiedValue)) {
      // This subscriber saw a value the set was never notified about, so the
      // baseline no longer describes every subscriber: a later revert back to
      // it must still wake them instead of being swallowed by the equality
      // check.
      this.notifiedValueStale = true;
    }
  }

  private notifySubscribers(): void {
    const subs = this.subscribers;
    if (subs.size === 0) return;
    if (subs.size === 1) {
      const only = subs.values().next().value as () => void;
      scheduleObserver(only);
      return;
    }
    // Snapshot to avoid issues with subscribers modifying the set during iteration
    const subscribersSnapshot = Array.from(subs);
    for (const subscriber of subscribersSnapshot) {
      scheduleObserver(subscriber);
    }
  }

  /**
   * Gets the computed value, recomputing if dependencies changed.
   * During untrack calls, getCurrentObserver returns undefined, preventing dependency tracking.
   */
  get value(): T {
    if (this.disposed) {
      return this.ensureDisposedValue();
    }

    const current = getCurrentObserver();
    const hadSubscribers = this.subscribers.size > 0;
    if (current && !this.subscribers.has(current)) {
      this.subscribers.add(current);
      registerDependency(current, this);
    }
    if (this.dirty) {
      this.recompute();
    }
    if (current) {
      this.syncNotifiedValue(hadSubscribers);
    }
    return this.cachedValue;
  }

  /**
   * Reads the current computed value without tracking.
   * Useful when you need the value but don't want to create a dependency.
   *
   * @returns The current cached value (recomputes if dirty)
   */
  peek(): T {
    if (this.disposed) {
      return this.ensureDisposedValue();
    }

    if (this.dirty) {
      this.recompute();
    }
    return this.cachedValue;
  }

  /**
   * Removes an observer from this computed's subscriber set.
   * @internal
   */
  unsubscribe(observer: () => void): void {
    this.subscribers.delete(observer);
  }

  /**
   * Disposes the computed value by unsubscribing its internal observer
   * from all upstream dependencies and clearing subscribers.
   */
  dispose(): void {
    this.disposed = true;
    if (this.dirty) {
      this.hasCachedValue = false;
    }
    this.dirty = false;
    clearDependencies(this.markDirty);
    this.subscribers.clear();
  }
}

/**
 * Creates a new computed value.
 *
 * If created inside an {@link effectScope}, the computed value is automatically
 * collected and will be disposed when the scope stops.
 *
 * @template T - The type of the computed value
 * @param fn - Function that computes the value from reactive sources
 * @returns A new Computed instance
 */
export const computed = <T>(fn: () => T): Computed<T> => {
  const c = new Computed(fn);

  // Auto-register with the current scope so scope.stop() disposes this computed
  const scope = getActiveScope();
  if (hasScopeDisposer(scope)) {
    scope._addDisposer(() => c.dispose());
  }

  return c;
};
