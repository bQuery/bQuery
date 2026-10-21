import type { BQueryPluginOptions } from './index.js';
import type { Plugin } from 'rollup';

/** Creates the bQuery Rollup plugin. */
declare const plugin: (options?: BQueryPluginOptions) => Plugin[];

export default plugin;
export type { BQueryPluginOptions };
