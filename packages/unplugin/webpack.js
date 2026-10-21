/**
 * webpack adapter for `@bquery/unplugin`.
 *
 * @module @bquery/unplugin/webpack
 */

import { bquery } from './index.js';

/** Creates the bQuery webpack plugin. See `BQueryPluginOptions` for options. */
export default bquery.webpack;
