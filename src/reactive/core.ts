/**
 * Core reactive signals.
 */

import {
  getCurrentObserver,
  registerDependency,
  removeDependency,
  scheduleObserver,
  type ReactiveSource,
} from './internals';

/**
 * A reactive value container that notifies subscribers on change.
 *
 * Signals are the foundational primitive of the reactive system.
 * Reading a signal's value inside an effect or computed automatically
 * establishes a reactive dependency.
 *
 * @template T - The type of the stored value
 */
export class Signal<T> implements ReactiveSource {
  private subscribers = new Set<() => void>();

  /**
   * Creates a new signal with an initial value.
   * @param _value - The initial value
   */
  constructor(private _value: T) {}

  /**
   * Gets the current value and tracks the read if inside an observer.
   * During untrack calls, getCurrentObserver returns undefined, preventing dependency tracking.
   */
  get value(): T {
    const current = getCurrentObserver();
    if (current) {
      this.subscribers.add(current);
      registerDependency(current, this);
    }
    return this._value;
  }

  /**
   * Sets a new value and notifies all subscribers if the value changed.
   * Uses Object.is for equality comparison.
   */
  set value(next: T) {
    if (Object.is(this._value, next)) return;
    this._value = next;
    // Create snapshot to avoid issues with subscribers modifying the set during iteration
    const subscribersSnapshot = Array.from(this.subscribers);
    for (const subscriber of subscribersSnapshot) {
      scheduleObserver(subscriber);
    }
  }

  /**
   * Reads the current value without tracking.
   * Useful when you need the value but don't want to create a dependency.
   *
   * @returns The current value
   */
  peek(): T {
    return this._value;
  }

  /**
   * Updates the value using a function.
   * Useful for updates based on the current value.
   *
   * @param updater - Function that receives current value and returns new value
   */
  update(updater: (current: T) => T): void {
    this.value = updater(this._value);
  }

  /**
   * Removes all subscribers from this signal.
   * Use this when a signal is no longer needed to prevent memory leaks.
   *
   * @example
   * ```ts
   * const count = signal(0);
   * effect(() => console.log(count.value));
   * count.dispose(); // All subscribers removed
   * ```
   */
  dispose(): void {
    // Remove this signal from each subscriber's dependency set
    // so the observer no longer holds a strong reference to it
    for (const subscriber of this.subscribers) {
      removeDependency(subscriber, this);
    }
    this.subscribers.clear();
  }

  /**
   * Removes an observer from this signal's subscriber set.
   * @internal
   */
  unsubscribe(observer: () => void): void {
    this.subscribers.delete(observer);
  }
}

/**
 * Creates a new reactive signal.
 *
 * @template T - The type of the signal value
 * @param value - The initial value
 * @returns A new Signal instance
 */
export const signal = <T>(value: T): Signal<T> => new Signal(value);
