/**
 * esbuild adapter for `@bquery/unplugin`.
 *
 * @module @bquery/unplugin/esbuild
 */

import { bquery } from './index.js';

/** Creates the bQuery esbuild plugin. See `BQueryPluginOptions` for options. */
export default bquery.esbuild;
