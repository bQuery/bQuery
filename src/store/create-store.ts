/**
 * Store creation logic.
 */

import {
  batch,
  computed,
  signal,
  untrack,
  type ReadonlySignal,
  type Signal,
} from '../reactive/index';
import { notifyDevtoolsStateChange, registerDevtoolsStore } from './devtools';
import { applyPlugins } from './plugins';
import { getStore, hasStore, registerStore } from './registry';
import type { Getters, Store, StoreDefinition, StoreSubscriber } from './types';
import { deepClone, detectNestedMutations, isDev } from './utils';

/**
 * Creates a reactive store with state, getters, and actions.
 *
 * @template S - State type
 * @template G - Getters type
 * @template A - Actions type
 * @param definition - Store definition
 * @returns The reactive store instance
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
  if (hasStore(id)) {
    console.warn(`bQuery store: Store "${id}" already exists. Returning existing instance.`);
    return getStore(id) as Store<S, G, A>;
  }

  // Create initial state
  const initialState = stateFactory();

  // Create signals for each state property
  const stateSignals = new Map<keyof S, Signal<unknown>>();
  for (const key of Object.keys(initialState) as Array<keyof S>) {
    stateSignals.set(key, signal(initialState[key]));
  }

  // Subscribers for $subscribe
  const subscribers: Array<StoreSubscriber<S>> = [];

  /**
   * Gets the current state.
   *
   * For subscriber notifications (where a plain object snapshot is needed),
   * this creates a shallow copy. For internal reads, use stateProxy directly.
   *
   * **Note:** Returns a shallow snapshot. Nested object mutations will NOT
   * trigger reactive updates. This differs from frameworks like Pinia that
   * use deep reactivity. To update nested state, replace the entire object.
   *
   * Uses `untrack()` to prevent accidental dependency tracking when called
   * from within reactive contexts (e.g., `effect()` or `computed()`).
   *
   * @internal
   */
  const getCurrentState = (): S =>
    untrack(() => {
      return { ...stateProxy };
    });

  /**
   * Notifies subscribers of state changes.
   * Short-circuits if there are no subscribers and devtools aren't active
   * to avoid unnecessary snapshot overhead.
   * @internal
   */
  const notifySubscribers = (): void => {
    // Early return if no subscribers and no devtools hook
    const hasDevtools =
      typeof window !== 'undefined' &&
      typeof window.__BQUERY_DEVTOOLS__?.onStateChange === 'function';
    if (subscribers.length === 0 && !hasDevtools) {
      return;
    }

    const currentState = getCurrentState();
    for (const callback of subscribers) {
      callback(currentState);
    }

    notifyDevtoolsStateChange(id, currentState);
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
        set: (target, prop, value) => {
          if (typeof prop === 'string' && stateSignals.has(prop as keyof S)) {
            stateSignals.get(prop as keyof S)!.value = value;
            notifySubscribers();
            return true;
          }
          // Allow non-state property assignments (e.g., temporary variables in actions)
          // by delegating to the target object rather than returning false
          return Reflect.set(target, prop, value);
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
      value: (callback: StoreSubscriber<S>) => {
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
            // Capture state before mutation for nested mutation detection
            const stateBefore = isDev ? deepClone(getCurrentState()) : null;
            const signalValuesBefore = isDev
              ? new Map(Array.from(stateSignals.entries()).map(([k, s]) => [k, s.value]))
              : null;

            // Mutation function
            const state = getCurrentState();
            partial(state);

            // Detect nested mutations in development mode
            if (isDev && stateBefore && signalValuesBefore) {
              const mutatedKeys = detectNestedMutations(stateBefore, state, signalValuesBefore);
              if (mutatedKeys.length > 0) {
                console.warn(
                  `[bQuery store "${id}"] Nested mutation detected in $patch() for keys: ${mutatedKeys
                    .map(String)
                    .join(', ')}.\n` +
                    'Nested object mutations do not trigger reactive updates because the store uses shallow reactivity.\n' +
                    'To fix this, either:\n' +
                    '  1. Replace the entire object: state.user = { ...state.user, name: "New" }\n' +
                    '  2. Use $patchDeep() for automatic deep cloning\n' +
                    'See: https://bquery.dev/guide/store#deep-reactivity'
                );
              }
            }

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
    $patchDeep: {
      value: (partial: Partial<S> | ((state: S) => void)) => {
        batch(() => {
          if (typeof partial === 'function') {
            // Deep clone state before mutation to ensure new references
            const state = deepClone(getCurrentState());
            partial(state);

            for (const [key, value] of Object.entries(state) as Array<[keyof S, unknown]>) {
              if (stateSignals.has(key)) {
                stateSignals.get(key)!.value = value;
              }
            }
          } else {
            // Deep clone each value in partial to ensure new references
            for (const [key, value] of Object.entries(partial) as Array<[keyof S, unknown]>) {
              if (stateSignals.has(key)) {
                stateSignals.get(key)!.value = deepClone(value);
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
  registerStore(id, store);

  // Apply plugins
  applyPlugins(store, definition);

  // Notify devtools
  registerDevtoolsStore(id, store);

  return store;
};
