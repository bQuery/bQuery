/**
 * Minimal state management built on signals.
 *
 * This module provides a lightweight store pattern inspired by Pinia/Vuex
 * but built entirely on bQuery's reactive primitives. Features include:
 * - Signal-based reactive state
 * - Computed getters
 * - Actions with async support
 * - Devtools hooks for debugging
 * - Plugin system for extensions
 *
 * @module bquery/store
 *
 * @example
 * ```ts
 * import { createStore } from 'bquery/store';
 * import { effect } from 'bquery/reactive';
 *
 * const counterStore = createStore({
 *   id: 'counter',
 *   state: () => ({ count: 0 }),
 *   getters: {
 *     doubled: (state) => state.count * 2,
 *     isPositive: (state) => state.count > 0,
 *   },
 *   actions: {
 *     increment() {
 *       this.count++;
 *     },
 *     async fetchAndSet(url: string) {
 *       const response = await fetch(url);
 *       const data = await response.json();
 *       this.count = data.count;
 *     },
 *   },
 * });
 *
 * effect(() => {
 *   console.log('Count:', counterStore.count);
 *   console.log('Doubled:', counterStore.doubled);
 * });
 *
 * counterStore.increment();
 * ```
 */

import { batch, computed, signal, type ReadonlySignal, type Signal } from '../reactive/index';

// ============================================================================
// Types
// ============================================================================

/**
 * Store state factory function.
 */
export type StateFactory<S> = () => S;

/**
 * Getter definition - derives computed values from state.
 */
export type Getters<S, G> = {
  [K in keyof G]: (state: S, getters: G) => G[K];
};

/**
 * Action definition - methods that can modify state.
 */
export type Actions<S, A> = {
  [K in keyof A]: A[K] extends (...args: infer P) => infer R
    ? (this: S & A, ...args: P) => R
    : never;
};

/**
 * Store definition for createStore.
 */
export type StoreDefinition<
  S extends Record<string, unknown> = Record<string, unknown>,
  G extends Record<string, unknown> = Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  A extends Record<string, (...args: any[]) => any> = Record<string, never>,
> = {
  /** Unique store identifier for devtools */
  id: string;
  /** State factory function */
  state: StateFactory<S>;
  /** Computed getters */
  getters?: Getters<S, G>;
  /** Action methods */
  actions?: A;
};

/**
 * The returned store instance with state, getters, and actions merged.
 */
export type Store<
  S extends Record<string, unknown>,
  G extends Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  A extends Record<string, (...args: any[]) => any>,
> = S &
  G &
  A & {
    /** Store identifier */
    $id: string;
    /** Reset state to initial values */
    $reset: () => void;
    /** Subscribe to state changes */
    $subscribe: (callback: (state: S) => void) => () => void;
    /** Patch multiple state properties at once */
    $patch: (partial: Partial<S> | ((state: S) => void)) => void;
    /** Get raw state object (non-reactive snapshot) */
    $state: S;
  };

/**
 * Plugin that can extend store functionality.
 */
export type StorePlugin<S = unknown> = (context: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: Store<any, any, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: StoreDefinition<any, any, any>;
}) => Partial<S> | void;

// ============================================================================
// Internal State
// ============================================================================

/** @internal Registry of all stores for devtools */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const storeRegistry = new Map<string, Store<any, any, any>>();

/** @internal Registered plugins */
const plugins: StorePlugin[] = [];

/** @internal Devtools hook */
declare global {
  interface Window {
    __BQUERY_DEVTOOLS__?: {
      stores: Map<string, unknown>;
      onStoreCreated?: (id: string, store: unknown) => void;
      onStateChange?: (id: string, state: unknown) => void;
    };
  }
}

// ============================================================================
// Store Creation
// ============================================================================

/**
 * Creates a reactive store with state, getters, and actions.
 *
 * @template S - State type
 * @template G - Getters type
 * @template A - Actions type
 * @param definition - Store definition
 * @returns The reactive store instance
 *
 * @example
 * ```ts
 * import { createStore } from 'bquery/store';
 *
 * // Simple counter store
 * const useCounter = createStore({
 *   id: 'counter',
 *   state: () => ({ count: 0, step: 1 }),
 *   getters: {
 *     doubled: (state) => state.count * 2,
 *     next: (state) => state.count + state.step,
 *   },
 *   actions: {
 *     increment() {
 *       this.count += this.step;
 *     },
 *     decrement() {
 *       this.count -= this.step;
 *     },
 *     setStep(newStep: number) {
 *       this.step = newStep;
 *     },
 *     async loadFromServer() {
 *       const res = await fetch('/api/counter');
 *       const data = await res.json();
 *       this.count = data.count;
 *     },
 *   },
 * });
 *
 * // Use the store
 * useCounter.increment();
 * console.log(useCounter.count); // 1
 * console.log(useCounter.doubled); // 2
 * ```
 */
export const createStore = <
  S extends Record<string, unknown>,
  G extends Record<string, unknown> = Record<string, never>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  A extends Record<string, (...args: any[]) => any> = Record<string, never>,
>(
  definition: StoreDefinition<S, G, A>
): Store<S, G, A> => {
  const { id, state: stateFactory, getters = {} as Getters<S, G>, actions = {} as A } = definition;

  // Check for duplicate store IDs
  if (storeRegistry.has(id)) {
    console.warn(`bQuery store: Store "${id}" already exists. Returning existing instance.`);
    return storeRegistry.get(id) as Store<S, G, A>;
  }

  // Create initial state
  const initialState = stateFactory();

  // Create signals for each state property
  const stateSignals = new Map<keyof S, Signal<unknown>>();
  for (const key of Object.keys(initialState) as Array<keyof S>) {
    stateSignals.set(key, signal(initialState[key]));
  }

  // Subscribers for $subscribe
  const subscribers: Array<(state: S) => void> = [];

  /**
   * Notifies subscribers of state changes.
   * @internal
   */
  const notifySubscribers = (): void => {
    const currentState = getCurrentState();
    for (const callback of subscribers) {
      callback(currentState);
    }

    // Notify devtools
    if (typeof window !== 'undefined' && window.__BQUERY_DEVTOOLS__?.onStateChange) {
      window.__BQUERY_DEVTOOLS__.onStateChange(id, currentState);
    }
  };

  /**
   * Cached state proxy that lazily reads signal values.
   * Uses a Proxy to avoid creating new objects on each access.
   *
   * **Note:** This returns a shallow snapshot of the state. Nested object
   * mutations will NOT trigger reactive updates. For nested reactivity,
   * replace the entire object or use signals for nested properties.
   *
   * @internal
   */
  const stateProxy = new Proxy({} as S, {
    get: (_, prop: string | symbol) => {
      const key = prop as keyof S;
      if (stateSignals.has(key)) {
        return stateSignals.get(key)!.value;
      }
      return undefined;
    },
    ownKeys: () => Array.from(stateSignals.keys()) as string[],
    getOwnPropertyDescriptor: (_, prop) => {
      if (stateSignals.has(prop as keyof S)) {
        return { enumerable: true, configurable: true };
      }
      return undefined;
    },
    has: (_, prop) => stateSignals.has(prop as keyof S),
  });

  /**
   * Gets the current state.
   *
   * For subscriber notifications (where a plain object snapshot is needed),
   * this creates a shallow copy. For internal reads, use stateProxy directly.
   *
   * **Note:** Returns a shallow snapshot. Nested object mutations will NOT
   * trigger reactive updates. This differs from frameworks like Pinia that
   * use deep reactivity. To update nested state, replace the entire object:
   *
   * @example
   * ```ts
   * // ❌ Won't trigger updates
   * store.user.name = 'New Name';
   *
   * // ✅ Will trigger updates
   * store.user = { ...store.user, name: 'New Name' };
   * ```
   *
   * @internal
   */
  const getCurrentState = (): S => ({ ...stateProxy });

  // Create computed getters
  const getterComputed = new Map<keyof G, ReadonlySignal<unknown>>();

  // Build the store proxy
  const store = {} as Store<S, G, A>;

  // Define state properties with getters/setters
  for (const key of Object.keys(initialState) as Array<keyof S>) {
    Object.defineProperty(store, key, {
      get: () => stateSignals.get(key)!.value,
      set: (value: unknown) => {
        stateSignals.get(key)!.value = value;
        notifySubscribers();
      },
      enumerable: true,
      configurable: false,
    });
  }

  // Define getters as computed properties
  for (const key of Object.keys(getters) as Array<keyof G>) {
    const getterFn = getters[key];

    // Create computed that reads from state signals via proxy (more efficient)
    const computedGetter = computed(() => {
      const state = stateProxy;
      // For getter dependencies, pass a proxy that reads from computed getters
      const getterProxy = new Proxy({} as G, {
        get: (_, prop: string | symbol) => {
          const propKey = prop as keyof G;
          if (getterComputed.has(propKey)) {
            return getterComputed.get(propKey)!.value;
          }
          return undefined;
        },
      });
      return getterFn(state, getterProxy);
    });

    getterComputed.set(key, computedGetter as unknown as ReadonlySignal<unknown>);

    Object.defineProperty(store, key, {
      get: () => computedGetter.value,
      enumerable: true,
      configurable: false,
    });
  }

  // Bind actions to the store context
  for (const key of Object.keys(actions) as Array<keyof A>) {
    const actionFn = actions[key];

    // Wrap action to enable 'this' binding
    (store as Record<string, unknown>)[key as string] = function (...args: unknown[]) {
      // Create a context that allows 'this.property' access
      const context = new Proxy(store, {
        get: (target, prop) => {
          if (typeof prop === 'string' && stateSignals.has(prop as keyof S)) {
            return stateSignals.get(prop as keyof S)!.value;
          }
          return (target as Record<string, unknown>)[prop as string];
        },
        set: (_target, prop, value) => {
          if (typeof prop === 'string' && stateSignals.has(prop as keyof S)) {
            stateSignals.get(prop as keyof S)!.value = value;
            notifySubscribers();
            return true;
          }
          return false;
        },
      });

      return actionFn.apply(context, args);
    };
  }

  // Add store utility methods
  Object.defineProperties(store, {
    $id: {
      value: id,
      writable: false,
      enumerable: false,
    },
    $reset: {
      value: () => {
        const fresh = stateFactory();
        batch(() => {
          for (const [key, sig] of stateSignals) {
            sig.value = fresh[key];
          }
        });
        notifySubscribers();
      },
      writable: false,
      enumerable: false,
    },
    $subscribe: {
      value: (callback: (state: S) => void) => {
        subscribers.push(callback);
        return () => {
          const index = subscribers.indexOf(callback);
          if (index > -1) subscribers.splice(index, 1);
        };
      },
      writable: false,
      enumerable: false,
    },
    $patch: {
      value: (partial: Partial<S> | ((state: S) => void)) => {
        batch(() => {
          if (typeof partial === 'function') {
            // Mutation function
            const state = getCurrentState();
            partial(state);
            for (const [key, value] of Object.entries(state) as Array<[keyof S, unknown]>) {
              if (stateSignals.has(key)) {
                stateSignals.get(key)!.value = value;
              }
            }
          } else {
            // Partial object
            for (const [key, value] of Object.entries(partial) as Array<[keyof S, unknown]>) {
              if (stateSignals.has(key)) {
                stateSignals.get(key)!.value = value;
              }
            }
          }
        });
        notifySubscribers();
      },
      writable: false,
      enumerable: false,
    },
    $state: {
      get: () => getCurrentState(),
      enumerable: false,
    },
  });

  // Register store
  storeRegistry.set(id, store);

  // Apply plugins
  for (const plugin of plugins) {
    const extension = plugin({ store, options: definition });
    if (extension) {
      Object.assign(store, extension);
    }
  }

  // Notify devtools
  if (typeof window !== 'undefined') {
    if (!window.__BQUERY_DEVTOOLS__) {
      window.__BQUERY_DEVTOOLS__ = { stores: new Map() };
    }
    window.__BQUERY_DEVTOOLS__.stores.set(id, store);
    window.__BQUERY_DEVTOOLS__.onStoreCreated?.(id, store);
  }

  return store;
};

// ============================================================================
// Store Utilities
// ============================================================================

/**
 * Retrieves an existing store by its ID.
 *
 * @param id - The store identifier
 * @returns The store instance or undefined if not found
 *
 * @example
 * ```ts
 * import { getStore } from 'bquery/store';
 *
 * const counter = getStore('counter');
 * if (counter) {
 *   counter.increment();
 * }
 * ```
 */
export const getStore = <T = unknown>(id: string): T | undefined => {
  return storeRegistry.get(id) as T | undefined;
};

/**
 * Lists all registered store IDs.
 *
 * @returns Array of store IDs
 *
 * @example
 * ```ts
 * import { listStores } from 'bquery/store';
 *
 * console.log('Active stores:', listStores());
 * ```
 */
export const listStores = (): string[] => {
  return Array.from(storeRegistry.keys());
};

/**
 * Removes a store from the registry.
 *
 * @param id - The store identifier
 *
 * @example
 * ```ts
 * import { destroyStore } from 'bquery/store';
 *
 * destroyStore('counter');
 * ```
 */
export const destroyStore = (id: string): void => {
  storeRegistry.delete(id);
  if (typeof window !== 'undefined' && window.__BQUERY_DEVTOOLS__) {
    window.__BQUERY_DEVTOOLS__.stores.delete(id);
  }
};

/**
 * Registers a plugin that extends all stores.
 *
 * @param plugin - The plugin function
 *
 * @example
 * ```ts
 * import { registerPlugin } from 'bquery/store';
 *
 * // Add localStorage persistence
 * registerPlugin(({ store, options }) => {
 *   const key = `bquery-store-${options.id}`;
 *
 *   // Load saved state
 *   const saved = localStorage.getItem(key);
 *   if (saved) {
 *     store.$patch(JSON.parse(saved));
 *   }
 *
 *   // Save on changes
 *   store.$subscribe((state) => {
 *     localStorage.setItem(key, JSON.stringify(state));
 *   });
 * });
 * ```
 */
export const registerPlugin = (plugin: StorePlugin): void => {
  plugins.push(plugin);
};

// ============================================================================
// Composition Helpers
// ============================================================================

/**
 * Creates a store with automatic persistence to localStorage.
 *
 * @param definition - Store definition
 * @param storageKey - Optional custom storage key
 * @returns The reactive store instance
 *
 * @example
 * ```ts
 * import { createPersistedStore } from 'bquery/store';
 *
 * const settings = createPersistedStore({
 *   id: 'settings',
 *   state: () => ({
 *     theme: 'dark',
 *     language: 'en',
 *   }),
 * });
 *
 * // State is automatically saved/loaded from localStorage
 * settings.theme = 'light';
 * ```
 */
export const createPersistedStore = <
  S extends Record<string, unknown>,
  G extends Record<string, unknown> = Record<string, never>,
  A extends Record<string, (...args: unknown[]) => unknown> = Record<string, never>,
>(
  definition: StoreDefinition<S, G, A>,
  storageKey?: string
): Store<S, G, A> => {
  const key = storageKey ?? `bquery-store-${definition.id}`;

  // Wrap state factory to load from storage
  const originalStateFactory = definition.state;
  definition.state = () => {
    const defaultState = originalStateFactory();

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          return { ...defaultState, ...JSON.parse(saved) };
        }
      } catch {
        // Ignore parse errors
      }
    }

    return defaultState;
  };

  const store = createStore(definition);

  // Subscribe to save changes
  store.$subscribe((state) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Ignore quota errors
      }
    }
  });

  return store;
};

/**
 * Maps store state properties to a reactive object for use in components.
 *
 * @param store - The store instance
 * @param keys - State keys to map
 * @returns Object with mapped properties
 *
 * @example
 * ```ts
 * import { mapState } from 'bquery/store';
 *
 * const counter = useCounter();
 * const { count, step } = mapState(counter, ['count', 'step']);
 * ```
 */
export const mapState = <S extends Record<string, unknown>, K extends keyof S>(
  store: S,
  keys: K[]
): Pick<S, K> => {
  const mapped = {} as Pick<S, K>;

  for (const key of keys) {
    Object.defineProperty(mapped, key, {
      get: () => store[key],
      enumerable: true,
    });
  }

  return mapped;
};

/**
 * Maps store actions to an object for easier destructuring.
 *
 * @param store - The store instance
 * @param keys - Action keys to map
 * @returns Object with mapped actions
 *
 * @example
 * ```ts
 * import { mapActions } from 'bquery/store';
 *
 * const counter = useCounter();
 * const { increment, decrement } = mapActions(counter, ['increment', 'decrement']);
 *
 * // Use directly
 * increment();
 * ```
 */
export const mapActions = <
  A extends Record<string, (...args: unknown[]) => unknown>,
  K extends keyof A,
>(
  store: A,
  keys: K[]
): Pick<A, K> => {
  const mapped = {} as Pick<A, K>;

  for (const key of keys) {
    (mapped as Record<string, unknown>)[key as string] = (...args: unknown[]) =>
      (store[key] as (...args: unknown[]) => unknown)(...args);
  }

  return mapped;
};
