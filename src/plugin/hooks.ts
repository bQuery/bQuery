/**
 * bQuery plugin hooks system (1.14+).
 *
 * Implements WordPress-style synchronous `filter` and `action` pipelines that
 * can be exercised by plugins via the {@link PluginInstallContext} or directly
 * by core/application code.
 *
 * @module bquery/plugin
 */

// Internal storage shapes ---------------------------------------------------

type FilterCallback<T = unknown> = (value: T, ...args: unknown[]) => T;
type ActionCallback = (...args: unknown[]) => void;

interface FilterEntry {
  fn: FilterCallback;
  priority: number;
  owner?: string;
}

interface ActionEntry {
  fn: ActionCallback;
  priority: number;
  owner?: string;
}

const filters = new Map<string, FilterEntry[]>();
const actions = new Map<string, ActionEntry[]>();

const insertSorted = <T extends { priority: number }>(list: T[], entry: T): void => {
  // Stable insertion sort by priority (lower first).
  let inserted = false;
  for (let i = 0; i < list.length; i++) {
    if (list[i].priority > entry.priority) {
      list.splice(i, 0, entry);
      inserted = true;
      break;
    }
  }
  if (!inserted) list.push(entry);
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/**
 * Register a filter callback for a named filter hook.
 *
 * Each filter receives the current value and any contextual arguments and
 * **must** return the (possibly transformed) value.
 *
 * @param name - Filter name (e.g. `'view:render'`).
 * @param fn - Filter callback `(value, ...args) => value`.
 * @param priority - Sort priority, lower runs first. Defaults to `10`.
 * @returns A function that removes the filter when called.
 *
 * @example
 * ```ts
 * addFilter('greeting', (text: string) => text.toUpperCase());
 * applyFilters('greeting', 'hello'); // 'HELLO'
 * ```
 */
export const addFilter = <T = unknown>(
  name: string,
  fn: (value: T, ...args: unknown[]) => T,
  priority = 10
): (() => void) => {
  return registerFilter(name, fn as FilterCallback, priority);
};

/** @internal */
export const registerFilter = (
  name: string,
  fn: FilterCallback,
  priority = 10,
  owner?: string
): (() => void) => {
  let list = filters.get(name);
  if (!list) {
    list = [];
    filters.set(name, list);
  }
  const entry: FilterEntry = { fn, priority, owner };
  insertSorted(list, entry);
  return (): void => {
    const current = filters.get(name);
    if (!current) return;
    const i = current.indexOf(entry);
    if (i >= 0) current.splice(i, 1);
    if (current.length === 0) filters.delete(name);
  };
};

/**
 * Apply all registered filters for the given name to `value`.
 *
 * @param name - Filter name.
 * @param value - Initial value.
 * @param args - Additional arguments forwarded to every filter callback.
 * @returns The value after all filters have been applied.
 */
export const applyFilters = <T>(name: string, value: T, ...args: unknown[]): T => {
  const list = filters.get(name);
  if (!list || list.length === 0) return value;
  let current: unknown = value;
  for (const entry of list) {
    try {
      current = entry.fn(current, ...args);
    } catch (error) {
      // Surface the error but don't break the entire chain.
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(`[bQuery] filter "${name}" threw:`, error);
      }
    }
  }
  return current as T;
};

/**
 * Remove a previously registered filter callback by reference. Returns `true`
 * if the callback was found and removed.
 */
export const removeFilter = <T = unknown>(
  name: string,
  fn: (value: T, ...args: unknown[]) => T
): boolean => {
  const list = filters.get(name);
  if (!list) return false;
  const i = list.findIndex((entry) => entry.fn === fn);
  if (i < 0) return false;
  list.splice(i, 1);
  if (list.length === 0) filters.delete(name);
  return true;
};

/** Remove every filter associated with the given plugin owner. @internal */
export const removeFiltersByOwner = (owner: string): void => {
  for (const [name, list] of filters) {
    const remaining = list.filter((entry) => entry.owner !== owner);
    if (remaining.length === 0) filters.delete(name);
    else filters.set(name, remaining);
  }
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Register an action callback for a named action hook.
 *
 * Actions are fire-and-forget; their return value is ignored.
 *
 * @param name - Action name (e.g. `'router:before-navigate'`).
 * @param fn - Action callback `(...args) => void`.
 * @param priority - Sort priority, lower runs first. Defaults to `10`.
 * @returns A function that removes the action when called.
 */
export const addAction = (
  name: string,
  fn: (...args: unknown[]) => void,
  priority = 10
): (() => void) => {
  return registerAction(name, fn, priority);
};

/** @internal */
export const registerAction = (
  name: string,
  fn: ActionCallback,
  priority = 10,
  owner?: string
): (() => void) => {
  let list = actions.get(name);
  if (!list) {
    list = [];
    actions.set(name, list);
  }
  const entry: ActionEntry = { fn, priority, owner };
  insertSorted(list, entry);
  return (): void => {
    const current = actions.get(name);
    if (!current) return;
    const i = current.indexOf(entry);
    if (i >= 0) current.splice(i, 1);
    if (current.length === 0) actions.delete(name);
  };
};

/** Dispatch every registered action callback in priority order. */
export const doAction = (name: string, ...args: unknown[]): void => {
  const list = actions.get(name);
  if (!list || list.length === 0) return;
  for (const entry of list) {
    try {
      entry.fn(...args);
    } catch (error) {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error(`[bQuery] action "${name}" threw:`, error);
      }
    }
  }
};

/** Remove a previously registered action callback. */
export const removeAction = (name: string, fn: (...args: unknown[]) => void): boolean => {
  const list = actions.get(name);
  if (!list) return false;
  const i = list.findIndex((entry) => entry.fn === fn);
  if (i < 0) return false;
  list.splice(i, 1);
  if (list.length === 0) actions.delete(name);
  return true;
};

/** Remove every action associated with the given plugin owner. @internal */
export const removeActionsByOwner = (owner: string): void => {
  for (const [name, list] of actions) {
    const remaining = list.filter((entry) => entry.owner !== owner);
    if (remaining.length === 0) actions.delete(name);
    else actions.set(name, remaining);
  }
};

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/** Remove every registered filter and action. Test-only. @internal */
export const resetHooks = (): void => {
  filters.clear();
  actions.clear();
};

/** Returns the list of currently registered filter names. */
export const listFilters = (): readonly string[] => [...filters.keys()];

/** Returns the list of currently registered action names. */
export const listActions = (): readonly string[] => [...actions.keys()];
