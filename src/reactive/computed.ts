/**
 * Computed reactive values.
 */

import { getCurrentObserver, scheduleObserver, track, clearDependencies, registerDependency, type ReactiveSource } from './internals';

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
  private dirty = true;
  private subscribers = new Set<() => void>();
  private readonly markDirty = () => {
    this.dirty = true;
    // Create snapshot to avoid issues with subscribers modifying the set during iteration
    const subscribersSnapshot = Array.from(this.subscribers);
    for (const subscriber of subscribersSnapshot) {
      scheduleObserver(subscriber);
    }
  };

  /**
   * Creates a new computed value.
   * @param compute - Function that computes the value
   */
  constructor(private readonly compute: () => T) {}

  /**
   * Gets the computed value, recomputing if dependencies changed.
   */
  get value(): T {
    const current = getCurrentObserver();
    if (current) {
      this.subscribers.add(current);
      registerDependency(current, this);
    }
    if (this.dirty) {
      this.dirty = false;
      // Clear old dependencies before recomputing
      clearDependencies(this.markDirty);
      this.cachedValue = track(this.markDirty, this.compute);
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
    if (this.dirty) {
      this.dirty = false;
      // Clear old dependencies before recomputing
      clearDependencies(this.markDirty);
      this.cachedValue = track(this.markDirty, this.compute);
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
}

/**
 * Creates a new computed value.
 *
 * @template T - The type of the computed value
 * @param fn - Function that computes the value from reactive sources
 * @returns A new Computed instance
 */
export const computed = <T>(fn: () => T): Computed<T> => new Computed(fn);
