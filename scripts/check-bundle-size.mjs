#!/usr/bin/env bun
/**
 * Enforce a bundle-size budget per public entry point (#216).
 *
 * Bundle size is a headline claim — three badges in the README — but nothing
 * failed when it regressed. The sizes Vite prints are no help either: an ESM
 * entry re-exports shared chunks, so `core.es.mjs` reads as 3.3 kB while
 * actually importing far more. This measures what a consumer pays instead:
 * each entry is bundled standalone with esbuild (minified, tree-shaken) and
 * the output gzipped.
 *
 * Node built-ins are external, as they are in any real bundle — `server` and
 * `ssr` reach for `node:http` on their server branch.
 *
 * The measurement is a ceiling, not the floor a real app hits: it imports
 * *everything* an entry exports, so tree-shaking an app's actual imports only
 * ever comes in under it.
 *
 * Requires a current `dist/` — run `bun run build` first.
 *
 *   bun scripts/check-bundle-size.mjs          # enforce budgets
 *   bun scripts/check-bundle-size.mjs --json   # measurements as JSON
 *   bun scripts/check-bundle-size.mjs --table  # markdown table for the docs
 */

import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

import { budgetBySubpath } from './bundle-budgets.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

/**
 * Resolve an `import` condition to its module path.
 *
 * The condition is either a bare string or a nested `{ types, default }`
 * branch — the shape publint and attw steer packages toward, and the one
 * this package adopted in #219. Reading only the string form silently
 * dropped every entry, and a dropped entry is invisible to the audit: it
 * never reaches `measurements`, so it is not reported as unbudgeted either,
 * and a new public entry ships unmeasured with CI green.
 */
export function importTarget(condition) {
  if (typeof condition === 'string') return condition;
  if (condition && typeof condition === 'object' && typeof condition.default === 'string') {
    return condition.default;
  }
  return null;
}

/**
 * The ESM target of every public entry, in `exports` order.
 *
 * `./package.json` is skipped deliberately; anything else that cannot be
 * resolved to an `.mjs` bundle is returned in `unsupported` so the audit can
 * fail on it rather than pass in silence.
 */
export async function publicEntries(pkg) {
  const manifest = pkg ?? JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'));
  const entries = [];
  const unsupported = [];

  for (const [subpath, conditions] of Object.entries(manifest.exports ?? {})) {
    // `"./package.json": "./package.json"` is a string export by design.
    if (typeof conditions !== 'object' || conditions === null) continue;

    const target = importTarget(conditions.import ?? conditions.default);
    if (target === null) {
      unsupported.push(`${subpath} — no import target this script can read; cannot measure.`);
      continue;
    }
    if (!target.endsWith('.mjs')) {
      unsupported.push(`${subpath} — import target ${target} is not an .mjs bundle.`);
      continue;
    }
    entries.push({ subpath, target });
  }

  entries.unsupported = unsupported;
  return entries;
}

/** Bundle one entry standalone and return its minified and gzipped sizes. */
export async function measureEntry(target) {
  const result = await build({
    stdin: {
      contents: `export * from '${target}';`,
      resolveDir: repoRoot,
      loader: 'js',
    },
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    // Node built-ins are external in any real bundle; `server`/`ssr` import
    // `node:http` on their server branch.
    external: ['node:*'],
    legalComments: 'none',
    logLevel: 'silent',
    write: false,
  });

  const code = result.outputFiles[0].contents;
  return { minified: code.length, gzip: gzipSync(code, { level: 9 }).length };
}

export async function measureAll() {
  const entries = await publicEntries();
  const measurements = [];

  for (const entry of entries) {
    if (!existsSync(resolve(repoRoot, entry.target))) {
      measurements.push({ ...entry, missing: true });
      continue;
    }
    measurements.push({ ...entry, ...(await measureEntry(entry.target)) });
  }

  // Carried through so the audit can fail on an entry it could not read,
  // rather than reporting only on the ones it happened to understand.
  measurements.unsupported = entries.unsupported ?? [];
  return measurements;
}

export function auditBudgets(measurements, budgets = budgetBySubpath()) {
  const problems = [];
  const unbudgeted = [];

  // An entry whose exports shape this script cannot read never reaches
  // `measurements`, so without this it would be invisible to both the
  // budget check and the unbudgeted check.
  for (const reason of measurements.unsupported ?? []) problems.push(reason);

  for (const entry of measurements) {
    if (entry.missing) {
      problems.push(`${entry.subpath} — build output ${entry.target} is missing.`);
      continue;
    }

    const budget = budgets.get(entry.subpath);
    if (budget === undefined) {
      unbudgeted.push(entry.subpath);
      continue;
    }

    if (entry.gzip > budget) {
      const over = (((entry.gzip - budget) / budget) * 100).toFixed(1);
      problems.push(
        `${entry.subpath} — ${kb(entry.gzip)} gzipped exceeds the ${kb(budget)} budget by ${over}%.`
      );
    }
  }

  // A new module with no budget is the regression path this check exists to
  // close, so it fails rather than passing silently.
  for (const subpath of unbudgeted) {
    problems.push(`${subpath} — no budget in scripts/bundle-budgets.mjs.`);
  }

  const stale = [...budgets.keys()].filter(
    (subpath) => !measurements.some((entry) => entry.subpath === subpath)
  );
  for (const subpath of stale) {
    problems.push(`${subpath} — budgeted but no longer a public entry point.`);
  }

  return { problems, unbudgeted, stale };
}

/** The markdown table published in docs/concepts/bundle-and-tree-shaking.md. */
export function renderTable(measurements, budgets = budgetBySubpath()) {
  const lines = [
    '| Entry point | Minified | Minified + gzip | Budget |',
    '| ----------- | -------- | --------------- | ------ |',
  ];

  for (const entry of measurements) {
    if (entry.missing) continue;
    const specifier =
      entry.subpath === '.' ? '@bquery/bquery' : `@bquery/bquery${entry.subpath.slice(1)}`;
    const budget = budgets.get(entry.subpath);
    lines.push(
      `| \`${specifier}\` | ${kb(entry.minified)} | **${kb(entry.gzip)}** | ${budget ? kb(budget) : '—'} |`
    );
  }

  return lines.join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  if (!existsSync(resolve(repoRoot, 'dist'))) {
    console.error('✗ No dist/ directory — run `bun run build` first.');
    process.exit(1);
  }

  const measurements = await measureAll();

  // Both reporting modes drop entries they cannot measure, so a partial
  // `dist/` would silently publish a table with rows missing. The docs tell
  // maintainers to regenerate with `--table` and paste the result, so this
  // has to fail loudly.
  const incomplete = measurements.filter((entry) => entry.missing).map((entry) => entry.subpath);
  const reporting = argv.includes('--json') || argv.includes('--table');

  if (reporting && (incomplete.length > 0 || (measurements.unsupported ?? []).length > 0)) {
    console.error(
      `✗ Cannot report on an incomplete build: ${[...incomplete, ...(measurements.unsupported ?? [])].join(', ')}.`
    );
    console.error('Run `bun run build` first.');
    process.exit(1);
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify(measurements, null, 2));
    process.exit(0);
  }

  if (argv.includes('--table')) {
    console.log(renderTable(measurements));
    process.exit(0);
  }

  const { problems } = auditBudgets(measurements);

  if (problems.length === 0) {
    // Not a package total: the per-module entries re-measure code the root
    // entry already contains, so summing them overstates the real surface
    // roughly threefold. Report the largest entry, which is a number that
    // means something on its own.
    const largest = measurements.reduce(
      (worst, entry) => ((entry.gzip ?? 0) > (worst.gzip ?? 0) ? entry : worst),
      measurements[0] ?? { subpath: '—', gzip: 0 }
    );
    console.log(
      `✓ All ${measurements.length} entry points are within budget ` +
        `(largest: ${largest.subpath} at ${kb(largest.gzip ?? 0)} gzipped).`
    );
    process.exit(0);
  }

  console.error('✗ Bundle size budget exceeded:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    `\nIf the growth is intended, raise the budget in ` +
      `${relative(repoRoot, resolve(__dirname, 'bundle-budgets.mjs'))} in the same PR and say why.`
  );
  process.exit(1);
}

export function isDirectExecution(argvEntry = process.argv[1]) {
  return Boolean(argvEntry) && import.meta.url === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution()) {
  await main();
}
