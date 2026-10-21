/**
 * `@bquery/unplugin` — the official bundler plugin for bQuery.
 *
 * One implementation (built on `unplugin`) with adapters for Vite, Rollup,
 * webpack, Rspack and esbuild. Features:
 *
 * - **views** — `*.view.html` / `*.html?bq-view` imports are precompiled with
 *   `@bquery/bquery/view/compiler` (CSP-safe, no `new Function()`), with HMR.
 * - **fileRoutes** — `virtual:bquery/routes` builds the route table from a
 *   directory with `createFileRoutes()`, replacing `import.meta.glob` wiring.
 * - **i18n** — keeps JSON catalogs in sync with the source via
 *   `@bquery/bquery/i18n/extract`, and serves them as `virtual:bquery/messages`.
 * - **csp** (Vite dev) — per-server-start nonce on every script/style tag plus a
 *   matching `Content-Security-Policy` header.
 * - **ssr** (Vite dev) — middleware rendering HTML navigations through your
 *   server entry with `ssrLoadModule()`.
 *
 * @module @bquery/unplugin
 */

import path from 'node:path';
import { createUnplugin } from 'unplugin';
import { createCspPlugin } from './src/csp.js';
import { createI18nPlugin, MESSAGES_MODULE_ID } from './src/i18n.js';
import { createRoutesPlugin, ROUTES_MODULE_ID } from './src/routes.js';
import { createSsrPlugin } from './src/ssr.js';
import { featureOptions, warnVia } from './src/utils.js';
import { createViewsPlugin } from './src/views.js';

export { MESSAGES_MODULE_ID, ROUTES_MODULE_ID };
export { buildCspPolicy, DEFAULT_CSP_DIRECTIVES } from './src/csp.js';
export { buildViewModule } from './src/views.js';
export { generateRoutesModule, scanRouteFiles } from './src/routes.js';
export { generateMessagesModule } from './src/i18n.js';

/** Bundlers on which the dev-server-only features (`csp`, `ssr`) work. */
const DEV_SERVER_FRAMEWORKS = new Set(['vite']);

/**
 * The unplugin factory: normalises options and returns one sub-plugin per
 * enabled feature, plus a core plugin that tracks the project root and mode.
 *
 * @param {import('./index.js').BQueryPluginOptions} [rawOptions] - Plugin options.
 * @param {{ framework: string }} meta - unplugin meta (which bundler).
 * @returns {import('unplugin').UnpluginOptions[]} The plugins.
 */
export const unpluginFactory = (rawOptions = {}, meta) => {
  const options = rawOptions ?? {};
  const shared = {
    root: path.resolve(options.root ?? process.cwd()),
    framework: meta.framework,
    viteServe: false,
    getNonce: undefined,
  };
  const setRoot = (root) => {
    if (!options.root && root) shared.root = path.resolve(root);
  };

  const views = featureOptions(options.views, true);
  const fileRoutes = featureOptions(options.fileRoutes, true);
  const i18n = featureOptions(options.i18n, false);
  const csp = featureOptions(options.csp, false);
  const ssr = featureOptions(options.ssr, false);

  const devOnly = [csp && 'csp', ssr && 'ssr'].filter(Boolean);
  let warned = false;

  const plugins = [
    {
      name: 'bquery',
      buildStart() {
        if (warned || devOnly.length === 0 || DEV_SERVER_FRAMEWORKS.has(meta.framework)) return;
        warned = true;
        warnVia(
          this,
          `[bquery] The ${devOnly.join(' and ')} option${devOnly.length > 1 ? 's are' : ' is'} ` +
            `only supported with Vite and ignored for ${meta.framework}.`
        );
      },
      vite: {
        configResolved(config) {
          setRoot(config.root);
          shared.viteServe = config.command === 'serve';
        },
      },
      webpack(compiler) {
        setRoot(compiler.options.context);
      },
      rspack(compiler) {
        setRoot(compiler.options.context);
      },
      esbuild: {
        config(initialOptions) {
          setRoot(initialOptions.absWorkingDir);
        },
      },
    },
  ];

  if (views) plugins.push(createViewsPlugin(views, shared));
  if (fileRoutes) plugins.push(createRoutesPlugin(fileRoutes, shared));
  if (i18n) plugins.push(createI18nPlugin(i18n, shared));
  if (DEV_SERVER_FRAMEWORKS.has(meta.framework)) {
    if (csp) plugins.push(createCspPlugin(csp, shared));
    if (ssr) plugins.push(createSsrPlugin(ssr, shared));
  }
  return plugins;
};

/**
 * The bQuery unplugin instance. Use the adapter for your bundler:
 * `bquery.vite()`, `bquery.rollup()`, `bquery.webpack()`, `bquery.rspack()`,
 * `bquery.esbuild()` — or import the matching subpath (`@bquery/unplugin/vite`).
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import bquery from '@bquery/unplugin/vite';
 *
 * export default { plugins: [bquery({ i18n: { catalog: 'locales/en.json' } })] };
 * ```
 */
export const bquery = createUnplugin(unpluginFactory);

export default bquery;
