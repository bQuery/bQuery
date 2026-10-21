import type { BQueryPluginOptions } from './index.js';
import type { Plugin } from 'vite';

/** Creates the bQuery Vite plugin. */
declare const plugin: (options?: BQueryPluginOptions) => Plugin[];

export default plugin;
export type { BQueryPluginOptions };
