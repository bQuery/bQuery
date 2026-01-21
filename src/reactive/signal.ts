/**
 * Reactive primitives inspired by fine-grained reactivity.
 *
 * This module provides a minimal but powerful reactive system:
 * - Signal: A reactive value that notifies subscribers when changed
 * - Computed: A derived value that automatically updates when dependencies change
 * - Effect: A side effect that re-runs when its dependencies change
 * - Batch: Group multiple updates to prevent intermediate re-renders
 *
 * @module bquery/reactive
 *
 * @example
 * ```ts
 * const count = signal(0);
 * const doubled = computed(() => count.value * 2);
 *
 * effect(() => {
 *   console.log(`Count: ${count.value}, Doubled: ${doubled.value}`);
 * });
 *
 * batch(() => {
 *   count.value = 1;
 *   count.value = 2;
 * });
 * // Logs: "Count: 2, Doubled: 4" (only once due to batching)
 * ```
 */

/**
 * Observer function type used internally for tracking reactivity.
 */
export type Observer = () => void;

/**
 * Cleanup function returned by effects for disposal.
 */
export type CleanupFn = () => void;

// Internal state for tracking the current observer context
let observerStack: Observer[] = [];
let batchDepth = 0;
const pendingObservers = new Set<Observer>();

/**
 * Tracks dependencies during a function execution.
 * @internal
 */
const track = <T>(observer: Observer, fn: () => T): T => {
  observerStack = [...observerStack, observer];
  try {
    return fn();
  } finally {
    observerStack = observerStack.slice(0, -1);
  }
};

/**
 * Schedules an observer to run, respecting batch mode.
 * @internal
 */
const scheduleObserver = (observer: Observer) => {
  if (batchDepth > 0) {
    pendingObservers.add(observer);
    return;
  }
  observer();
};

/**
 * Flushes all pending observers after a batch completes.
 * @internal
 */
const flushObservers = () => {
  for (const observer of Array.from(pendingObservers)) {
    pendingObservers.delete(observer);
    observer();
  }
};

/**
 * A reactive value container that notifies subscribers on change.
 *
 * Signals are the foundational primitive of the reactive system.
 * Reading a signal's value inside an effect or computed automatically
 * establishes a reactive dependency.
 *
 * @template T - The type of the stored value
 *
 * @example
 * ```ts
 * const name = signal('World');
 * console.log(name.value); // 'World'
 *
 * name.value = 'bQuery';
 * console.log(name.value); // 'bQuery'
 * ```
 */
export class Signal<T> {
  private subscribers = new Set<Observer>();

  /**
   * Creates a new signal with an initial value.
   * @param _value - The initial value
   */
  constructor(private _value: T) {}

  /**
   * Gets the current value and tracks the read if inside an observer.
   */
  get value(): T {
    const current = observerStack[observerStack.length - 1];
    if (current) {
      this.subscribers.add(current);
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
 * A computed value that derives from other reactive sources.
 *
 * Computed values are lazily evaluated and cached. They only
 * recompute when their dependencies change.
 *
 * @template T - The type of the computed value
 *
 * @example
 * ```ts
 * const price = signal(100);
 * const quantity = signal(2);
 * const total = computed(() => price.value * quantity.value);
 *
 * console.log(total.value); // 200
 * price.value = 150;
 * console.log(total.value); // 300
 * ```
 */
export class Computed<T> {
  private cachedValue!: T;
  private dirty = true;
  private subscribers = new Set<Observer>();
  private readonly markDirty = () => {
    this.dirty = true;
    for (const subscriber of this.subscribers) {
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
    const current = observerStack[observerStack.length - 1];
    if (current) {
      this.subscribers.add(current);
    }
    if (this.dirty) {
      this.dirty = false;
      this.cachedValue = track(this.markDirty, this.compute);
    }
    return this.cachedValue;
  }
}

/**
 * Creates a new reactive signal.
 *
 * @template T - The type of the signal value
 * @param value - The initial value
 * @returns A new Signal instance
 *
 * @example
 * ```ts
 * const count = signal(0);
 * count.value++; // Triggers subscribers
 * ```
 */
export const signal = <T>(value: T): Signal<T> => new Signal(value);

/**
 * Creates a new computed value.
 *
 * @template T - The type of the computed value
 * @param fn - Function that computes the value from reactive sources
 * @returns A new Computed instance
 *
 * @example
 * ```ts
 * const doubled = computed(() => count.value * 2);
 * ```
 */
export const computed = <T>(fn: () => T): Computed<T> => new Computed(fn);

/**
 * Creates a side effect that automatically re-runs when dependencies change.
 *
 * The effect runs immediately upon creation and then re-runs whenever
 * any signal or computed value read inside it changes.
 *
 * @param fn - The effect function to run
 * @returns A cleanup function to stop the effect
 *
 * @example
 * ```ts
 * const count = signal(0);
 *
 * const cleanup = effect(() => {
 *   document.title = `Count: ${count.value}`;
 * });
 *
 * // Later, to stop the effect:
 * cleanup();
 * ```
 */
export const effect = (fn: () => void | CleanupFn): CleanupFn => {
  let cleanupFn: CleanupFn | void;
  let isDisposed = false;

  const observer: Observer = () => {
    if (isDisposed) return;

    // Run previous cleanup if exists
    if (cleanupFn) {
      cleanupFn();
    }

    // Run effect and capture cleanup
    cleanupFn = track(observer, fn);
  };

  observer();

  return () => {
    isDisposed = true;
    if (cleanupFn) {
      cleanupFn();
    }
  };
};

/**
 * Batches multiple signal updates into a single notification cycle.
 *
 * Updates made inside the batch function are deferred until the batch
 * completes, preventing intermediate re-renders and improving performance.
 *
 * @param fn - Function containing multiple signal updates
 *
 * @example
 * ```ts
 * batch(() => {
 *   firstName.value = 'John';
 *   lastName.value = 'Doe';
 *   age.value = 30;
 * });
 * // Effects only run once with all three updates
 * ```
 */
export const batch = (fn: () => void): void => {
  batchDepth += 1;
  try {
    fn();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) {
      flushObservers();
    }
  }
};

/**
 * Creates a signal that persists to localStorage.
 *
 * @template T - The type of the signal value
 * @param key - The localStorage key
 * @param initialValue - The initial value if not found in storage
 * @returns A Signal that syncs with localStorage
 *
 * @example
 * ```ts
 * const theme = persistedSignal('theme', 'light');
 * theme.value = 'dark'; // Automatically saved to localStorage
 * ```
 */
export const persistedSignal = <T>(key: string, initialValue: T): Signal<T> => {
  let stored: T = initialValue;

  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      stored = JSON.parse(raw) as T;
    }
  } catch {
    // Use initial value on parse error
  }

  const sig = signal(stored);

  // Create an effect to persist changes
  effect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(sig.value));
    } catch {
      // Ignore storage errors
    }
  });

  return sig;
};
