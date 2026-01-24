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
const observerStack: Observer[] = [];
let batchDepth = 0;
const pendingObservers = new Set<Observer>();

// Flag to disable tracking temporarily (for untrack)
let trackingEnabled = true;

/**
 * Tracks dependencies during a function execution.
 * Uses direct push/pop for O(1) operations instead of array copying.
 * @internal
 */
const track = <T>(observer: Observer, fn: () => T): T => {
  observerStack.push(observer);
  try {
    return fn();
  } finally {
    observerStack.pop();
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
   * Respects the global tracking state (disabled during untrack calls).
   */
  get value(): T {
    if (trackingEnabled) {
      const current = observerStack[observerStack.length - 1];
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

  /**
   * Reads the current computed value without tracking.
   * Useful when you need the value but don't want to create a dependency.
   *
   * @returns The current cached value (recomputes if dirty)
   */
  peek(): T {
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

// ============================================================================
// Extended Reactive Utilities
// ============================================================================

/**
 * A readonly wrapper around a signal that prevents writes.
 * Provides read-only access to a signal's value while maintaining reactivity.
 *
 * @template T - The type of the wrapped value
 */
export interface ReadonlySignal<T> {
  /** Gets the current value with dependency tracking. */
  readonly value: T;
  /** Gets the current value without dependency tracking. */
  peek(): T;
}

/**
 * Creates a read-only view of a signal.
 * Useful for exposing reactive state without allowing modifications.
 *
 * @template T - The type of the signal value
 * @param sig - The signal to wrap
 * @returns A readonly signal wrapper
 *
 * @example
 * ```ts
 * const _count = signal(0);
 * const count = readonly(_count); // Expose read-only version
 *
 * console.log(count.value); // 0
 * count.value = 1; // TypeScript error: Cannot assign to 'value'
 * ```
 */
export const readonly = <T>(sig: Signal<T>): ReadonlySignal<T> => ({
  get value(): T {
    return sig.value;
  },
  peek(): T {
    return sig.peek();
  },
});

/**
 * Watches a signal or computed value and calls a callback with old and new values.
 * Unlike effect, watch provides access to the previous value.
 *
 * @template T - The type of the watched value
 * @param source - The signal or computed to watch
 * @param callback - Function called with (newValue, oldValue) on changes
 * @param options - Watch options
 * @returns A cleanup function to stop watching
 *
 * @example
 * ```ts
 * const count = signal(0);
 *
 * const cleanup = watch(count, (newVal, oldVal) => {
 *   console.log(`Changed from ${oldVal} to ${newVal}`);
 * });
 *
 * count.value = 5; // Logs: "Changed from 0 to 5"
 * cleanup();
 * ```
 */
export const watch = <T>(
  source: Signal<T> | Computed<T>,
  callback: (newValue: T, oldValue: T | undefined) => void,
  options: { immediate?: boolean } = {}
): CleanupFn => {
  let oldValue: T | undefined;
  let isFirst = true;

  return effect(() => {
    const newValue = source.value;

    if (isFirst) {
      isFirst = false;
      oldValue = newValue;
      if (options.immediate) {
        callback(newValue, undefined);
      }
      return;
    }

    callback(newValue, oldValue);
    oldValue = newValue;
  });
};

/**
 * Executes a function without tracking any signal dependencies.
 * Useful when reading a signal value without creating a reactive dependency.
 *
 * @template T - The return type of the function
 * @param fn - The function to execute without tracking
 * @returns The result of the function
 *
 * @example
 * ```ts
 * const count = signal(0);
 *
 * effect(() => {
 *   // This creates a dependency
 *   console.log('Tracked:', count.value);
 *
 *   // This does NOT create a dependency
 *   const untracked = untrack(() => otherSignal.value);
 * });
 * ```
 */
export const untrack = <T>(fn: () => T): T => {
  const prevTracking = trackingEnabled;
  trackingEnabled = false;
  try {
    return fn();
  } finally {
    trackingEnabled = prevTracking;
  }
};

/**
 * Type guard to check if a value is a Signal instance.
 *
 * @param value - The value to check
 * @returns True if the value is a Signal
 *
 * @example
 * ```ts
 * const count = signal(0);
 * const num = 42;
 *
 * isSignal(count); // true
 * isSignal(num);   // false
 * ```
 */
export const isSignal = (value: unknown): value is Signal<unknown> => value instanceof Signal;

/**
 * Type guard to check if a value is a Computed instance.
 *
 * @param value - The value to check
 * @returns True if the value is a Computed
 *
 * @example
 * ```ts
 * const doubled = computed(() => count.value * 2);
 * isComputed(doubled); // true
 * ```
 */
export const isComputed = (value: unknown): value is Computed<unknown> => value instanceof Computed;
