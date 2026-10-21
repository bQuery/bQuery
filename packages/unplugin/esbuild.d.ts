import type { BQueryPluginOptions } from './index.js';
import type { Plugin } from 'esbuild';

/** Creates the bQuery esbuild plugin. */
declare const plugin: (options?: BQueryPluginOptions) => Plugin;

export default plugin;
export type { BQueryPluginOptions };
