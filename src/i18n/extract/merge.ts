/**
 * Catalog merging for message extraction.
 * @module bquery/i18n
 */

import { flatten, unflatten, type ExtractedCatalog, type ExtractedMessage } from './extract';

/** Outcome of merging freshly extracted messages into an existing catalog. */
export type MergeResult = {
  /** The merged, nested catalog. */
  catalog: ExtractedCatalog;
  /** Keys newly introduced by this extraction run. */
  added: string[];
  /** Keys present before but no longer found in source (only when `prune`). */
  removed: string[];
  /** Count of existing translations preserved untouched. */
  kept: number;
};

/** Options for {@link mergeCatalog}. */
export type MergeOptions = {
  /**
   * Drop keys that exist in `existing` but are no longer found in source.
   * Default `false` — stale keys are preserved so translations are never lost
   * by accident. Pass `true` for a strict prune.
   */
  prune?: boolean;
};

/**
 * Merges extracted messages into an existing catalog without clobbering
 * already-translated values.
 *
 * - **New keys** are added with their extracted default (the `defineMessages`
 *   source string, or `''` for keys seen only in `t()` calls).
 * - **Existing keys** keep their current value — translations are never
 *   overwritten.
 * - **Stale keys** are preserved unless `prune` is set.
 *
 * @param existing - The current catalog (e.g. parsed from `locales/en.json`)
 * @param extracted - Flat messages from {@link extractFromSource}
 * @param options - Merge behaviour
 * @returns The merged catalog plus a diff summary
 */
export const mergeCatalog = (
  existing: ExtractedCatalog,
  extracted: ExtractedMessage[],
  options: MergeOptions = {}
): MergeResult => {
  const existingFlat = new Map(flatten(existing).map((e) => [e.key, e.value]));
  const extractedKeys = new Set(extracted.map((e) => e.key));

  const out: ExtractedMessage[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  let kept = 0;

  for (const { key, value } of extracted) {
    const prior = existingFlat.get(key);
    if (prior !== undefined) {
      out.push({ key, value: prior });
      kept += 1;
    } else {
      added.push(key);
      out.push({ key, value });
    }
  }

  for (const [key, value] of existingFlat) {
    if (extractedKeys.has(key)) continue;
    if (options.prune) removed.push(key);
    else out.push({ key, value });
  }

  return {
    catalog: unflatten(out),
    added: added.sort(),
    removed: removed.sort(),
    kept,
  };
};
