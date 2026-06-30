/**
 * Optional message-extraction tooling for the i18n module.
 *
 * Build-tool-agnostic and dependency-free: scan source for `defineMessages`
 * catalogs and `t()` / `tc()` calls, then emit or merge a JSON catalog —
 * preserving existing translations. Importing this entry point is entirely
 * optional and never required to use i18n at runtime (the zero-build path is
 * preserved).
 *
 * @example
 * ```ts
 * import { extractFromSource, mergeCatalog } from '@bquery/bquery/i18n/extract';
 *
 * const found = extractFromSource(sourceCode);
 * const { catalog, added } = mergeCatalog(existingCatalog, found);
 * ```
 *
 * @example Via the CLI (lets your shell or its own glob expansion pick files):
 * ```sh
 * bquery-i18n extract "src/**\/*.ts" --out locales/en.json
 * ```
 *
 * @module bquery/i18n/extract
 */

export {
  extractFromSource,
  flatten,
  unflatten,
  type ExtractedCatalog,
  type ExtractedMessage,
} from './extract';
export { mergeCatalog, type MergeOptions, type MergeResult } from './merge';
export {
  expandGlobs,
  extractFiles,
  runExtractCli,
  type CliIO,
  type ExtractFilesResult,
  type ExtractRunOptions,
} from './cli';
