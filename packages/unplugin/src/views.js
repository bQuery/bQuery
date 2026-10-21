/**
 * View precompilation: turns `*.view.html` (or any `*.html?bq-view`) imports
 * into the module emitted by `@bquery/bquery/view/compiler`, plus a default
 * export holding the template markup.
 *
 * @module @bquery/unplugin/views
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compileViews, emitModule } from '@bquery/bquery/view/compiler';
import { cleanId, createFilter, hasQueryFlag, toPosix, warnVia } from './utils.js';

/** Default glob for files treated as view templates without a query flag. */
export const DEFAULT_VIEW_INCLUDE = ['**/*.view.html'];

/** Default query flag that opts any `.html` import into view compilation. */
export const DEFAULT_VIEW_QUERY = 'bq-view';

/**
 * Builds the JavaScript module for one template.
 *
 * @param {string} template - The template markup.
 * @param {object} options - Normalised view options.
 * @param {boolean} hmr - Whether to append Vite HMR handling.
 * @returns {{ code: string, stats: import('@bquery/bquery/view/compiler').CompileStats }}
 *   The module source and the compiler statistics.
 */
export const buildViewModule = (template, options, hmr) => {
  const compiled = compileViews(template, { prefix: options.prefix, globals: options.globals });
  let code = emitModule(compiled, options.importSpecifier);
  code += `\nconst template = ${JSON.stringify(template)};\nexport default template;\n`;
  if (hmr) {
    // The new module instance re-registers its expressions when it executes.
    // The markup itself lives in importers, so let them update when it changed.
    code +=
      'if (import.meta.hot) {\n' +
      '  import.meta.hot.accept((next) => {\n' +
      "    if (!next || next.default !== template) import.meta.hot.invalidate('bQuery view template changed');\n" +
      '  });\n' +
      '}\n';
  }
  return { code, stats: compiled.stats };
};

/**
 * Creates the `bquery:views` plugin.
 *
 * @param {object} options - View options (see `ViewsOptions` in `index.d.ts`).
 * @param {{ root: string, viteServe: boolean }} shared - Shared plugin state.
 * @returns {import('unplugin').UnpluginOptions} The plugin.
 */
export const createViewsPlugin = (options, shared) => {
  const query = options.query ?? DEFAULT_VIEW_QUERY;
  const warnSkipped = options.warnSkipped !== false;
  let filter;
  let filterRoot;
  const matches = (file) => {
    if (!filter || filterRoot !== shared.root) {
      filterRoot = shared.root;
      filter = createFilter(shared.root, options.include ?? DEFAULT_VIEW_INCLUDE, options.exclude);
    }
    return filter(file);
  };

  /** Resolves a specifier to an absolute template path, or `null`. */
  const resolveTemplate = (file, importer) => {
    if (path.isAbsolute(file) && existsSync(file)) return file;
    if (file.startsWith('/')) {
      // Vite-style root-relative URL (`/src/views/home.view.html`).
      const fromRoot = path.join(shared.root, file);
      return existsSync(fromRoot) ? fromRoot : null;
    }
    if (file.startsWith('./') || file.startsWith('../')) {
      const base =
        importer && !importer.startsWith('\0') ? path.dirname(cleanId(importer)) : shared.root;
      return path.resolve(base, file);
    }
    return null;
  };

  return {
    name: 'bquery:views',
    enforce: 'pre',
    resolveId(source, importer, resolveOptions) {
      if (source.startsWith('\0') || resolveOptions?.isEntry) return null;
      const file = cleanId(source);
      if (!file.endsWith('.html')) return null;
      const flagged = hasQueryFlag(source, query);
      const abs = resolveTemplate(file, importer);
      if (!abs) return null;
      if (!flagged && !matches(abs)) return null;
      // Vite's dependency scanner would read the id from disk; templates have
      // no imports worth scanning, so keep them out of it.
      if (resolveOptions?.scan) return { id: source, external: true };
      return `${toPosix(abs)}?${query}`;
    },
    loadInclude(id) {
      return hasQueryFlag(id, query) && cleanId(id).endsWith('.html');
    },
    async load(id) {
      if (!hasQueryFlag(id, query)) return null;
      const file = cleanId(id);
      this.addWatchFile?.(file);
      const template = await readFile(file, 'utf8');
      const { code, stats } = buildViewModule(template, options, shared.viteServe);
      if (warnSkipped && stats.skipped.length > 0) {
        const rel = toPosix(path.relative(shared.root, file));
        for (const { expression, reason } of stats.skipped) {
          warnVia(
            this,
            `[bquery:views] ${rel}: "${expression}" falls back to the runtime evaluator (${reason}).`
          );
        }
      }
      options.onCompiled?.({ file, stats });
      return { code, map: null };
    },
  };
};
