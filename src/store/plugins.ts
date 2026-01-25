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

/** @internal */
export const applyPlugins = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: Store<any, any, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: StoreDefinition<any, any, any>
): void => {
  for (const plugin of plugins) {
    const extension = plugin({ store, options });
    if (extension) {
      Object.assign(store, extension);
    }
  }
};
