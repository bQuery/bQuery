/**
 * Canonical bundle-size budgets, one per public entry point (#216).
 *
 * `gzip` is the **transitive** cost of importing everything an entry exports:
 * the entry is bundled standalone with esbuild (minified, tree-shaken, Node
 * built-ins external) and the result gzipped. That is the number a consumer
 * pays, unlike the per-file sizes Vite prints, which exclude the shared chunks
 * an entry re-exports.
 *
 * Budgets are ceilings in bytes, set roughly 15% above the measured size so
 * ordinary growth does not trip them. When a change legitimately grows an
 * entry, raise its budget in the same PR and say why — that is the point:
 * the number moves visibly, in review, rather than silently.
 *
 * Run `bun scripts/check-bundle-size.mjs --json` to see current measurements.
 */

/**
 * @typedef {object} BudgetEntry
 * @property {string} subpath  The public specifier, e.g. `@bquery/bquery/core`.
 * @property {number} gzip     Ceiling for the gzipped, minified bundle, in bytes.
 * @property {string} [note]   Why this entry is unusually large or small.
 */

/** @type {ReadonlyArray<BudgetEntry>} */
export const BUNDLE_BUDGETS = [
  {
    subpath: '.',
    gzip: 148000,
    note: 'Re-exports the common helpers of every module — nearly as large as /full when you import all of it. Tree-shaking is what makes this entry cheap in practice.',
  },
  { subpath: './full', gzip: 149000, note: 'Every public export; for CDN use, not bundlers.' },
  { subpath: './core', gzip: 15000 },
  { subpath: './reactive', gzip: 14000 },
  { subpath: './concurrency', gzip: 12000 },
  { subpath: './component', gzip: 13000 },
  { subpath: './motion', gzip: 13000 },
  { subpath: './security', gzip: 4000 },
  { subpath: './platform', gzip: 5000 },
  { subpath: './router', gzip: 11000 },
  { subpath: './store', gzip: 6000 },
  { subpath: './view', gzip: 16000 },
  { subpath: './view/compiler', gzip: 6000 },
  { subpath: './storybook', gzip: 5000 },
  { subpath: './forms', gzip: 12000 },
  { subpath: './i18n', gzip: 5000 },
  { subpath: './i18n/extract', gzip: 3000 },
  { subpath: './a11y', gzip: 7000 },
  { subpath: './dnd', gzip: 7000 },
  { subpath: './media', gzip: 8000 },
  { subpath: './plugin', gzip: 3000 },
  { subpath: './devtools', gzip: 4000 },
  { subpath: './testing', gzip: 8000 },
  { subpath: './ssr', gzip: 39000, note: 'Pulls in the view renderer and the HTML parser.' },
  { subpath: './server', gzip: 36000, note: 'Pulls in the router, SSR and the sanitizer.' },
];

/** Budgets keyed by subpath. */
export const budgetBySubpath = () =>
  new Map(BUNDLE_BUDGETS.map((entry) => [entry.subpath, entry.gzip]));
