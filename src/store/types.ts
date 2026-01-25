/**
 * Store types for bQuery's state module.
 * @module bquery/store
 */

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
 * Store subscriber callback.
 */
export type StoreSubscriber<S> = (state: S) => void;

/**
 * Patch payload for store updates.
 */
export type StorePatch<S> = Partial<S> | ((state: S) => void);

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
    $subscribe: (callback: StoreSubscriber<S>) => () => void;
    /** Patch multiple state properties at once (shallow) */
    $patch: (partial: StorePatch<S>) => void;
    /**
     * Patch with deep reactivity support.
     * Unlike $patch, this method deep-clones nested objects before mutation,
     * ensuring that all changes trigger reactive updates.
     */
    $patchDeep: (partial: StorePatch<S>) => void;
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
