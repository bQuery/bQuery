import type { BQueryPluginOptions } from './index.js';
import type { WebpackPluginInstance } from 'unplugin';

/** Creates the bQuery webpack plugin. */
declare const plugin: (options?: BQueryPluginOptions) => WebpackPluginInstance;

export default plugin;
export type { BQueryPluginOptions };
