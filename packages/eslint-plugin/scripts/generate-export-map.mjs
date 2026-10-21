#!/usr/bin/env bun
/**
 * Generate `src/export-map.json` for the `prefer-subpath-imports` rule: every
 * name exported from the root `@bquery/bquery` entry, mapped to the module
 * subpath (`@bquery/bquery/<subpath>`) that exports the same binding.
 *
 * The subpaths are the module barrels (`src/<module>/index.ts`) listed in the
 * root `package.json` `exports`. Exports are resolved with the TypeScript
 * compiler API, so renamed re-exports (`sanitize` → `sanitizeHtml`) and names
 * that differ between modules (`prefersReducedMotion` in `motion` vs `a11y`)
 * are matched by binding, not by name.
 *
 * Usage (from the repository root):
 *   bun packages/eslint-plugin/scripts/generate-export-map.mjs          # write
 *   bun packages/eslint-plugin/scripts/generate-export-map.mjs --check  # fail if stale
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '..', '..');

/** Path of the generated map. */
export const EXPORT_MAP_PATH = resolve(packageDir, 'src', 'export-map.json');

/** Export keys that are not module barrels. */
const NON_MODULE_EXPORTS = new Set(['.', './full', './package.json']);

/**
 * Read the module subpaths (`core`, `view/compiler`, …) from the root
 * `package.json` `exports`, in declaration order.
 *
 * @returns {Promise<string[]>} Subpaths whose `src/<subpath>/index.ts` barrel exists
 */
export const readSubpaths = async () => {
  const pkg = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'));
  return Object.keys(pkg.exports)
    .filter((key) => !NON_MODULE_EXPORTS.has(key) && !/\.[a-z]+$/i.test(key))
    .map((key) => key.slice(2))
    .filter((subpath) => existsSync(resolve(repoRoot, 'src', subpath, 'index.ts')));
};

/**
 * Resolve an export symbol through aliases to the binding it names.
 *
 * @param {ts.TypeChecker} checker - Type checker
 * @param {ts.Symbol} symbol - Exported symbol
 * @returns {ts.Symbol} The original symbol
 */
const original = (checker, symbol) =>
  symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

/**
 * Build the export → subpath map.
 *
 * @returns {Promise<{ map: Record<string, string>, unmapped: string[] }>} The
 *   sorted map and the root exports no subpath re-exports
 */
export const buildExportMap = async () => {
  const subpaths = await readSubpaths();
  const rootFile = resolve(repoRoot, 'src', 'index.ts');
  const barrels = subpaths.map((subpath) => resolve(repoRoot, 'src', subpath, 'index.ts'));
  const program = ts.createProgram([rootFile, ...barrels], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: [],
    noEmit: true,
    skipLibCheck: true,
    strict: true,
  });
  const checker = program.getTypeChecker();
  const exportsOf = (file) => {
    const source = program.getSourceFile(file);
    const moduleSymbol = source && checker.getSymbolAtLocation(source);
    if (!moduleSymbol) throw new Error(`Cannot resolve module ${relative(repoRoot, file)}`);
    return checker.getExportsOfModule(moduleSymbol);
  };

  /** name → [{ subpath, symbol }] for every barrel export. */
  const candidates = new Map();
  subpaths.forEach((subpath, index) => {
    for (const symbol of exportsOf(barrels[index])) {
      const list = candidates.get(symbol.name) ?? [];
      list.push({ subpath, symbol: original(checker, symbol) });
      candidates.set(symbol.name, list);
    }
  });

  /**
   * Pick the subpath whose directory holds the declaration (longest match),
   * falling back to the first barrel in `package.json` order.
   */
  const pick = (matches, symbol) => {
    const declarationFile = symbol.declarations?.[0]?.getSourceFile().fileName ?? '';
    const relativeFile = relative(resolve(repoRoot, 'src'), declarationFile).split(sep).join('/');
    const owning = matches
      .filter(({ subpath }) => relativeFile.startsWith(`${subpath}/`))
      .sort((a, b) => b.subpath.length - a.subpath.length);
    return (owning[0] ?? matches[0]).subpath;
  };

  const map = {};
  const unmapped = [];
  const rootExports = exportsOf(rootFile)
    .filter((symbol) => symbol.name !== 'default')
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const rootSymbol of rootExports) {
    const name = rootSymbol.name;
    const target = original(checker, rootSymbol);
    const matches = (candidates.get(name) ?? []).filter(({ symbol }) => symbol === target);
    if (matches.length === 0) {
      unmapped.push(name);
      continue;
    }
    map[name] = pick(matches, target);
  }
  return { map, unmapped };
};

/**
 * Serialise the map with the repository's Prettier config.
 *
 * @param {Record<string, string>} map - Export → subpath map
 * @returns {Promise<string>} Formatted JSON
 */
export const formatExportMap = async (map) => {
  const prettier = await import('prettier');
  const options = (await prettier.resolveConfig(EXPORT_MAP_PATH)) ?? {};
  const value = {
    $comment:
      'Generated by packages/eslint-plugin/scripts/generate-export-map.mjs from the src/<module>/index.ts barrels — do not edit by hand.',
    exports: map,
  };
  return prettier.format(JSON.stringify(value), { ...options, filepath: EXPORT_MAP_PATH });
};

const main = async () => {
  const check = process.argv.includes('--check');
  const { map, unmapped } = await buildExportMap();
  const content = await formatExportMap(map);
  const current = existsSync(EXPORT_MAP_PATH) ? await readFile(EXPORT_MAP_PATH, 'utf8') : '';
  const label = relative(repoRoot, EXPORT_MAP_PATH);
  if (unmapped.length > 0) {
    console.warn(`Root exports without a subpath: ${unmapped.join(', ')}`);
  }
  if (check) {
    if (current !== content) {
      console.error(
        `${label} is stale. Run: bun packages/eslint-plugin/scripts/generate-export-map.mjs`
      );
      process.exit(1);
    }
    console.log(`${label} is up to date (${Object.keys(map).length} exports).`);
    return;
  }
  if (current !== content) await writeFile(EXPORT_MAP_PATH, content);
  console.log(`Wrote ${label} (${Object.keys(map).length} exports).`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
