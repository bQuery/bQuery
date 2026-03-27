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
 * The `this` context includes state, getters, and other actions.
 */
export type Actions<S, G, A> = {
  [K in keyof A]: A[K];
} & ThisType<S & G & A>;

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
  actions?: Actions<S, G, A>;
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
 * Action function record used by store definitions and lifecycle hooks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StoreActionRecord = Record<string, (...args: any[]) => any>;

type ActionName<A extends StoreActionRecord> = keyof A & string;
type ActionArgs<A extends StoreActionRecord, K extends ActionName<A>> = Parameters<A[K]>;
type ActionResult<A extends StoreActionRecord, K extends ActionName<A>> = Awaited<ReturnType<A[K]>>;

/**
 * Context provided to `$onAction` callbacks.
 *
 * @example
 * ```ts
 * store.$onAction(({ name, args, after, onError }) => {
 *   console.log(`Action "${name}" called with`, args);
 *   after((result) => console.log(`Returned:`, result));
 *   onError((err) => console.error(`Failed:`, err));
 * });
 * ```
 */
export type ActionContext<
  S extends Record<string, unknown>,
  G extends Record<string, unknown>,
  A extends StoreActionRecord,
  K extends ActionName<A> = ActionName<A>,
> = {
  /** The name of the action being called */
  name: K;
  /** The store instance */
  store: Store<S, G, A>;
  /** The arguments passed to the action */
  args: ActionArgs<A, K>;
  /**
   * Register a callback to run after the action completes successfully.
   * For async actions, runs after the returned promise resolves.
   */
  after: (callback: (result: ActionResult<A, K>) => void) => void;
  /**
   * Register a callback to run if the action throws or the returned
   * promise rejects.
   */
  onError: (callback: (error: unknown) => void) => void;
};

/**
 * Callback for `$onAction`.
 */
export type OnActionCallback<
  S extends Record<string, unknown>,
  G extends Record<string, unknown>,
  A extends StoreActionRecord,
> = <K extends ActionName<A>>(context: ActionContext<S, G, A, K>) => void;

/**
 * The returned store instance with state, getters, and actions merged.
 */
export type Store<
  S extends Record<string, unknown>,
  G extends Record<string, unknown>,
  A extends StoreActionRecord,
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
    /**
     * Hook into action calls. The callback receives an {@link ActionContext}
     * with `after` and `onError` hooks for the full action lifecycle.
     *
     * @param callback - Invoked before each action execution
     * @returns A function to remove the hook
     *
     * @example
     * ```ts
     * const unsub = store.$onAction(({ name, args, after, onError }) => {
     *   const start = Date.now();
     *   after(() => console.log(`${name} took ${Date.now() - start}ms`));
     *   onError((e) => console.error(`${name} failed`, e));
     * });
     * ```
     */
    $onAction: (callback: OnActionCallback<S, G, A>) => () => void;
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

/**
 * Serializer interface for persisted stores.
 *
 * @example
 * ```ts
 * const dateSerializer: StoreSerializer = {
 *   serialize: (state) => JSON.stringify(state, (_, v) =>
 *     v instanceof Date ? v.toISOString() : v),
 *   deserialize: (raw) => JSON.parse(raw),
 * };
 * ```
 */
export type StoreSerializer = {
  /** Convert state to a string for storage */
  serialize: (state: unknown) => string;
  /** Convert a stored string back to state */
  deserialize: (raw: string) => unknown;
};

/**
 * Storage backend interface for persisted stores.
 * Compatible with `localStorage`, `sessionStorage`, or any custom adapter.
 *
 * @example
 * ```ts
 * createPersistedStore(definition, {
 *   storage: sessionStorage,
 * });
 * ```
 */
export type StorageBackend = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

/**
 * Options for `createPersistedStore`.
 *
 * @example
 * ```ts
 * createPersistedStore(definition, {
 *   key: 'my-store',
 *   storage: sessionStorage,
 *   serializer: { serialize: JSON.stringify, deserialize: JSON.parse },
 *   version: 2,
 *   migrate: (persisted, version) => {
 *     if (version < 2) return { ...persisted, newField: 'default' };
 *     return persisted;
 *   },
 * });
 * ```
 */
export type PersistedStoreOptions = {
  /** Custom storage key. Defaults to `"bquery-store-${id}"`. */
  key?: string;
  /** Storage backend. Defaults to `localStorage`. */
  storage?: StorageBackend;
  /** Custom serializer/deserializer. Defaults to JSON. */
  serializer?: StoreSerializer;
  /**
   * Schema version number. When this changes and `migrate` is provided,
   * the migration function is called with the old state and version.
   */
  version?: number;
  /**
   * Migration function called when the persisted version differs from
   * the current `version`. Receives the deserialized state and the old
   * version number. Must return the migrated state object.
   */
  migrate?: (
    persistedState: Record<string, unknown>,
    oldVersion: number
  ) => Record<string, unknown>;
};
