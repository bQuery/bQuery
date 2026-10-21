/**
 * i18n: keeps JSON catalogs in sync with the source (`t()` / `tc()` calls and
 * `defineMessages()` literals) and exposes them as `virtual:bquery/messages`
 * with hot reloading in Vite.
 *
 * @module @bquery/unplugin/i18n
 */

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { extractFromSource, mergeCatalog } from '@bquery/bquery/i18n/extract';
import { resolvedVirtualId } from './routes.js';
import {
  cleanId,
  createFilter,
  readTextIfExists,
  toPosix,
  walkFiles,
  warnVia,
  writeIfChanged,
} from './utils.js';

/** Public id of the catalogs virtual module. */
export const MESSAGES_MODULE_ID = 'virtual:bquery/messages';

/** Default source globs scanned for messages. */
export const DEFAULT_I18N_INCLUDE = ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}'];

/** Default source-locale catalog. */
export const DEFAULT_CATALOG = 'locales/en.json';

/**
 * The non-magic directory prefix of a glob (the directory to walk).
 *
 * @param {string} glob - A glob pattern.
 * @returns {string} A relative directory (`'.'` for the root).
 */
const globBase = (glob) => {
  const normalized = glob.replace(/^\.\//, '');
  const firstMagic = normalized.search(/[*?{]/);
  const head = firstMagic === -1 ? normalized : normalized.slice(0, firstMagic);
  const slash = head.lastIndexOf('/');
  return slash === -1 ? '.' : head.slice(0, slash) || '.';
};

/**
 * Normalises the configured catalogs into `{ locale, file, primary }` records.
 *
 * @param {object} options - i18n options.
 * @param {string} root - Project root.
 * @returns {Array<{ locale: string, file: string, primary: boolean }>} Catalogs,
 *   source locale first.
 */
export const resolveCatalogs = (options, root) => {
  const nameOf = (file) => path.basename(file, path.extname(file));
  const catalog = options.catalog ?? DEFAULT_CATALOG;
  const out = [{ locale: nameOf(catalog), file: path.resolve(root, catalog), primary: true }];
  const extra = options.locales ?? [];
  const entries = Array.isArray(extra)
    ? extra.map((file) => [nameOf(file), file])
    : Object.entries(extra);
  for (const [locale, file] of entries) {
    const abs = path.resolve(root, file);
    if (out.some((c) => c.file === abs)) continue;
    out.push({ locale, file: abs, primary: false });
  }
  return out;
};

/**
 * Serialises a catalog exactly like the `bquery-i18n` CLI (2-space JSON plus a
 * trailing newline), so the plugin and the CLI never fight over formatting.
 *
 * @param {object} catalog - Nested catalog.
 * @returns {string} JSON text.
 */
const serialize = (catalog) => `${JSON.stringify(catalog, null, 2)}\n`;

/**
 * Parses a catalog file. A missing or empty file is `{}`; a file that is not a
 * JSON object yields `null` (with a warning) so callers never overwrite a
 * catalog that is mid-edit or otherwise broken.
 *
 * @param {string} file - Absolute path.
 * @param {(msg: string) => void} [warn] - Warning sink for invalid JSON.
 * @returns {Promise<object | null>} The parsed catalog, or `null` when invalid.
 */
const readCatalog = async (file, warn) => {
  const text = await readTextIfExists(file);
  if (text === undefined || text.trim() === '') return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    throw new Error('expected a JSON object');
  } catch (error) {
    warn?.(
      `[bquery:i18n] ${file} is not a valid JSON catalog (${error.message}); leaving it untouched.`
    );
    return null;
  }
};

/**
 * Creates the extraction engine: a per-file cache of extracted messages plus a
 * serialised writer that merges them into every configured catalog.
 *
 * @param {object} options - i18n options.
 * @param {{ root: string }} shared - Shared plugin state.
 * @returns {object} The engine (`scanAll`, `update`, `write`, `matches`, `catalogs`).
 */
export const createI18nEngine = (options, shared) => {
  const cache = new Map();
  let queue = Promise.resolve();
  let filter;
  let filterRoot;

  const matches = (file) => {
    if (!filter || filterRoot !== shared.root) {
      filterRoot = shared.root;
      filter = createFilter(shared.root, options.include ?? DEFAULT_I18N_INCLUDE, options.exclude);
    }
    return filter(file);
  };

  const extractFile = async (file) => {
    try {
      cache.set(toPosix(file), extractFromSource(await readFile(file, 'utf8')));
    } catch {
      cache.delete(toPosix(file));
    }
  };

  const scanAll = async () => {
    cache.clear();
    const include = options.include ?? DEFAULT_I18N_INCLUDE;
    const patterns = Array.isArray(include) ? include : [include];
    const bases = new Set(
      patterns.map((p) => (typeof p === 'string' ? globBase(p) : '.')).map((b) => b || '.')
    );
    // Walk each base once; a root-level base subsumes the others.
    const roots = bases.has('.') ? ['.'] : [...bases];
    const outDirs = ['dist', 'build', 'coverage'].map((d) => path.resolve(shared.root, d));
    for (const base of roots) {
      const files = await walkFiles(path.resolve(shared.root, base), (dir) =>
        outDirs.includes(dir)
      );
      for (const file of files) if (matches(file)) await extractFile(file);
    }
  };

  /** Combined extracted messages: first non-empty value wins (like the CLI). */
  const collect = () => {
    const messages = new Map();
    for (const file of [...cache.keys()].sort()) {
      for (const { key, value } of cache.get(file)) {
        const prior = messages.get(key);
        if (prior === undefined || (prior === '' && value !== '')) messages.set(key, value);
      }
    }
    return [...messages.entries()].map(([key, value]) => ({ key, value }));
  };

  const catalogs = () => resolveCatalogs(options, shared.root);

  const writeNow = async (warn) => {
    const extracted = collect();
    const results = [];
    for (const catalog of catalogs()) {
      const existing = await readCatalog(catalog.file, warn);
      if (existing === null) {
        results.push({ ...catalog, written: false, added: [], removed: [] });
        continue;
      }
      const input = catalog.primary ? extracted : extracted.map(({ key }) => ({ key, value: '' }));
      const merged = mergeCatalog(existing, input, { prune: options.prune === true });
      const written = await writeIfChanged(catalog.file, serialize(merged.catalog));
      results.push({ ...catalog, written, added: merged.added, removed: merged.removed });
    }
    options.onExtract?.(results);
    return results;
  };

  /** Serialises writes so overlapping watch events never interleave. */
  const write = (warn) => {
    const run = queue.then(() => writeNow(warn));
    queue = run.catch(() => undefined);
    return run;
  };

  const update = async (file, event, warn) => {
    if (event === 'delete') cache.delete(toPosix(file));
    else await extractFile(file);
    return write(warn);
  };

  return { scanAll, update, write, matches, catalogs, readCatalog };
};

/**
 * Generates the source of `virtual:bquery/messages`.
 *
 * @param {Record<string, object>} messages - Catalogs keyed by locale.
 * @param {boolean} hmr - Whether to append Vite HMR handling.
 * @returns {string} ES module source.
 */
export const generateMessagesModule = (messages, hmr) => {
  const lines = [
    '// Generated by @bquery/unplugin (i18n). Do not edit.',
    `export const messages = ${JSON.stringify(messages, null, 2)};`,
    `export const locales = ${JSON.stringify(Object.keys(messages))};`,
    'export default messages;',
  ];
  if (!hmr) {
    lines.push(
      '/** Registers an i18n instance for catalog hot reloading (no-op outside Vite dev). */',
      'export function hotReload(i18n) { return i18n; }',
      ''
    );
    return lines.join('\n');
  }
  lines.push(
    'const instances = import.meta.hot',
    '  ? (import.meta.hot.data.bqueryI18n ??= new Set())',
    '  : new Set();',
    '/** Registers an i18n instance so edited catalogs are merged into it live. */',
    'export function hotReload(i18n, onUpdate) {',
    '  instances.add({ i18n, onUpdate });',
    '  return i18n;',
    '}',
    'if (import.meta.hot) {',
    '  import.meta.hot.accept((next) => {',
    '    if (!next) return;',
    '    if (instances.size === 0) return import.meta.hot.invalidate();',
    '    for (const { i18n, onUpdate } of instances) {',
    '      for (const locale of Object.keys(next.messages)) {',
    '        i18n.mergeMessages(locale, next.messages[locale]);',
    '      }',
    '      if (onUpdate) onUpdate(next.messages);',
    '    }',
    '  });',
    '}',
    ''
  );
  return lines.join('\n');
};

/**
 * Creates the `bquery:i18n` plugin.
 *
 * @param {object} options - i18n options (see `I18nOptions` in `index.d.ts`).
 * @param {{ root: string, framework: string, viteServe: boolean }} shared - Shared state.
 * @returns {import('unplugin').UnpluginOptions} The plugin.
 */
export const createI18nPlugin = (options, shared) => {
  const engine = createI18nEngine(options, shared);
  const resolvedId = () => resolvedVirtualId(MESSAGES_MODULE_ID, shared);
  const extract = options.extract !== false;

  return {
    name: 'bquery:i18n',
    async buildStart() {
      if (!extract) return;
      await engine.scanAll();
      await engine.write((msg) => warnVia(this, msg));
    },
    async watchChange(id, change) {
      if (!extract || !engine.matches(cleanId(id))) return;
      await engine.update(cleanId(id), change?.event, (msg) => warnVia(this, msg));
    },
    resolveId(source) {
      return source === MESSAGES_MODULE_ID ? resolvedId() : null;
    },
    loadInclude(id) {
      return id === resolvedId();
    },
    async load(id) {
      if (id !== resolvedId()) return null;
      const messages = {};
      for (const catalog of engine.catalogs()) {
        this.addWatchFile?.(catalog.file);
        messages[catalog.locale] =
          (await engine.readCatalog(catalog.file, (msg) => warnVia(this, msg))) ?? {};
      }
      return { code: generateMessagesModule(messages, shared.viteServe), map: null };
    },
  };
};
