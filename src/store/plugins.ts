/**
 * Store plugins API.
 */

import type { Store, StoreDefinition, StorePlugin } from './types';

/** @internal Registered plugins */
const plugins: StorePlugin[] = [];

/**
 * Registers a plugin that extends all stores.
 *
 * @param plugin - The plugin function
 */
export const registerPlugin = (plugin: StorePlugin): void => {
  plugins.push(plugin);
};

/**
 * Unregisters a previously registered plugin.
 *
 * Removes the first matching registration by reference identity. Subsequent
 * stores created via `defineStore()` will no longer receive the plugin's
 * extensions; already-created stores keep any previously applied extensions.
 *
 * @param plugin - The plugin function passed to {@link registerPlugin}
 * @returns `true` if the plugin was found and removed, `false` otherwise
 *
 * @example
 * ```ts
 * import { registerPlugin, unregisterPlugin } from '@bquery/bquery/store';
 *
 * const logger = ({ store }) => {
 *   store.$subscribe(console.log);
 * };
 *
 * registerPlugin(logger);
 * // …later
 * unregisterPlugin(logger); // → true
 * ```
 */
export const unregisterPlugin = (plugin: StorePlugin): boolean => {
  const index = plugins.indexOf(plugin);
  if (index === -1) return false;
  plugins.splice(index, 1);
  return true;
};

/**
 * Removes all registered store plugins.
 *
 * Useful in test teardown to ensure plugin state does not leak between
 * test cases or between independently authored test files.
 *
 * @example
 * ```ts
 * import { clearPlugins } from '@bquery/bquery/store';
 *
 * afterEach(() => clearPlugins());
 * ```
 */
export const clearPlugins = (): void => {
  plugins.length = 0;
};

/** @internal */
export const applyPlugins = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: Store<any, any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: StoreDefinition<any, any, any>
): void => {
  for (const plugin of [...plugins]) {
    const extension = plugin({ store, options });
    if (extension) {
      Object.assign(store, extension);
    }
  }
};
