#!/usr/bin/env bun
/**
 * Canonical, machine-readable stability matrix — the single source of truth for
 * every module's maturity (#150).
 *
 * `STABILITY.md`, the README "Module status" table, and the docs
 * `introduction.md` matrix are all validated against this data by
 * `scripts/check-stability-matrix.mjs` (`bun run check:stability`), so the three
 * surfaces can no longer silently drift apart.
 *
 * When a module changes status, update THIS file (and append a line to the
 * module's history in `STABILITY.md`); the check will tell you which docs to
 * reconcile.
 */

/** @typedef {'Stable' | 'Beta' | 'Experimental'} StabilityStatus */

/**
 * @typedef {Object} ModuleStability
 * @property {string} module - Public sub-path module name (e.g. `router`).
 * @property {StabilityStatus} status - Current maturity.
 * @property {string} [targetStable] - Minor version a non-Stable module targets.
 */

/** @type {ReadonlyArray<ModuleStability>} */
export const STABILITY_MATRIX = [
  { module: 'core', status: 'Stable' },
  { module: 'reactive', status: 'Stable' },
  { module: 'security', status: 'Stable' },
  { module: 'component', status: 'Stable' },
  { module: 'motion', status: 'Stable' },
  { module: 'platform', status: 'Stable' },
  { module: 'router', status: 'Stable' },
  { module: 'store', status: 'Stable' },
  { module: 'view', status: 'Beta', targetStable: '1.15.0' },
  { module: 'forms', status: 'Beta', targetStable: '1.15.0' },
  { module: 'i18n', status: 'Beta', targetStable: '1.15.0' },
  { module: 'a11y', status: 'Beta', targetStable: '1.15.0' },
  { module: 'dnd', status: 'Beta', targetStable: '1.15.0' },
  { module: 'media', status: 'Beta', targetStable: '1.15.0' },
  { module: 'plugin', status: 'Beta', targetStable: '1.15.0' },
  { module: 'devtools', status: 'Beta', targetStable: '1.15.0' },
  { module: 'testing', status: 'Beta', targetStable: '1.15.0' },
  { module: 'storybook', status: 'Beta', targetStable: '1.15.0' },
  { module: 'concurrency', status: 'Experimental', targetStable: '1.15.0' },
  { module: 'ssr', status: 'Experimental', targetStable: '1.15.0' },
  { module: 'server', status: 'Experimental', targetStable: '1.15.0' },
];

/** The three buckets, in display order. */
export const STATUS_ORDER = /** @type {const} */ (['Stable', 'Beta', 'Experimental']);

/** Build a `module → status` lookup from the canonical matrix. */
export function statusByModule(matrix = STABILITY_MATRIX) {
  const map = new Map();
  for (const entry of matrix) map.set(entry.module, entry.status);
  return map;
}

/** Group module names by status, preserving matrix order within each bucket. */
export function modulesByStatus(matrix = STABILITY_MATRIX) {
  /** @type {Record<StabilityStatus, string[]>} */
  const grouped = { Stable: [], Beta: [], Experimental: [] };
  for (const entry of matrix) grouped[entry.status].push(entry.module);
  return grouped;
}
