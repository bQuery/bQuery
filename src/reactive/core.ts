/**
 * Core reactive signals.
 */

import { getCurrentObserver, isTrackingEnabled, scheduleObserver } from './internals';

/**
 * A reactive value container that notifies subscribers on change.
 *
 * Signals are the foundational primitive of the reactive system.
 * Reading a signal's value inside an effect or computed automatically
 * establishes a reactive dependency.
 *
 * @template T - The type of the stored value
 */
export class Signal<T> {
  private subscribers = new Set<() => void>();

  /**
   * Creates a new signal with an initial value.
   * @param _value - The initial value
   */
  constructor(private _value: T) {}

  /**
   * Gets the current value and tracks the read if inside an observer.
   * Respects the global tracking state (disabled during untrack calls).
   */
  get value(): T {
    if (isTrackingEnabled()) {
      const current = getCurrentObserver();
      if (current) {
        this.subscribers.add(current);
      }
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
    for (const subscriber of this.subscribers) {
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
}

/**
 * Creates a new reactive signal.
 *
 * @template T - The type of the signal value
 * @param value - The initial value
 * @returns A new Signal instance
 */
export const signal = <T>(value: T): Signal<T> => new Signal(value);
