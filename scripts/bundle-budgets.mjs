/**
 * Canonical bundle-size budgets, one per public entry point (#216).
 *
 * `gzip` is the **transitive** cost of importing everything an entry exports:
 * the entry is bundled standalone with esbuild (minified, tree-shaken, Node
 * built-ins external) and the result gzipped. That is the number a consumer
 * pays, unlike the per-file sizes Vite prints, which exclude the shared chunks
 * an entry re-exports.
 *
 * Budgets are ceilings in bytes, derived as `ceil(measured * 1.15 / 100) * 100`
 * so every entry gets the same 15% headroom. Rounding to the nearest 1 kB
 * instead gave the small entries far more slack than the large ones —
 * `./security` could grow 42% before failing, which is exactly the size of
 * regression worth catching in a module people pick for a small footprint.
 *
 * Set above the measured size so
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
    gzip: 147500,
    note: 'Re-exports the common helpers of every module — nearly as large as /full when you import all of it. Tree-shaking is what makes this entry cheap in practice.',
  },
  { subpath: './full', gzip: 148800, note: 'Every public export; for CDN use, not bundlers.' },
  { subpath: './core', gzip: 14400 },
  { subpath: './reactive', gzip: 13400 },
  { subpath: './concurrency', gzip: 11100 },
  {
    subpath: './component',
    gzip: 14900,
    note: 'Sanitizes its own DOM writes, so it carries the security module (#229).',
  },
  { subpath: './motion', gzip: 12600 },
  {
    subpath: './security',
    gzip: 5400,
    note: 'Ships both sanitizer backends — the DOM one and the DOM-free string scanner (#229) — because which one runs is decided at runtime, not at bundle time.',
  },
  { subpath: './platform', gzip: 4500 },
  { subpath: './router', gzip: 10500 },
  { subpath: './store', gzip: 5100 },
  { subpath: './view', gzip: 15800 },
  { subpath: './view/compiler', gzip: 5700 },
  {
    subpath: './storybook',
    gzip: 6400,
    note: 'Re-exports the sanitizer for unsafeHtml(), so it grew with #229.',
  },
  { subpath: './forms', gzip: 11600 },
  { subpath: './i18n', gzip: 4800 },
  { subpath: './i18n/extract', gzip: 2900 },
  { subpath: './a11y', gzip: 7000 },
  { subpath: './dnd', gzip: 6400 },
  { subpath: './media', gzip: 7400 },
  { subpath: './plugin', gzip: 2700 },
  { subpath: './devtools', gzip: 3600 },
  { subpath: './testing', gzip: 7800 },
  { subpath: './ssr', gzip: 38600, note: 'Pulls in the view renderer and the HTML parser.' },
  {
    subpath: './server',
    gzip: 41300,
    note: 'Pulls in the router, SSR and the sanitizer, so it grew with #229 too.',
  },
];

/** Budgets keyed by subpath. */
export const budgetBySubpath = () =>
  new Map(BUNDLE_BUDGETS.map((entry) => [entry.subpath, entry.gzip]));
