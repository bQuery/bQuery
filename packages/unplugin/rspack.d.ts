import type { BQueryPluginOptions } from './index.js';
import type { RspackPluginInstance } from 'unplugin';

/** Creates the bQuery Rspack plugin. */
declare const plugin: (options?: BQueryPluginOptions) => RspackPluginInstance;

export default plugin;
export type { BQueryPluginOptions };
