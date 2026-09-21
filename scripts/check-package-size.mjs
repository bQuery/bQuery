#!/usr/bin/env bun
/**
 * Keep the published tarball from quietly re-inflating (#220).
 *
 * The package shipped 11.3 MB unpacked across 972 files, 6.4 MB of which was
 * JS source maps nobody asked for. Excluding them is a one-line `files` change
 * — and a one-line change to undo by accident, since nothing about a build
 * failure looks like "the tarball doubled".
 *
 * Checks the real `npm pack` file list, so it sees exactly what a consumer
 * would install. Requires a current `dist/` — run `bun run build` first.
 *
 * Usage: bun scripts/check-package-size.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');

/**
 * Ceilings, with headroom over the measured 1.3 MB / 5.2 MB / 1211 files.
 *
 * The count rose from 924 to 1211 with #219, 284 of those files being the
 * parallel `.d.cts` tree that makes `require('@bquery/bquery')` type-check.
 * They carry almost no bytes, so packed and unpacked size barely moved —
 * which is why only this ceiling needed raising.
 */
export const BUDGET = {
  packedBytes: 1.6 * 1024 * 1024,
  unpackedBytes: 6 * 1024 * 1024,
  fileCount: 1400,
};

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/** Read a shipped bundle, tolerating a file the pack list names but disk does not. */
export const readSource = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
};

/**
 * Ask npm what it would publish.
 *
 * Captures stderr: discarding it turned a failing `npm pack` into a raw
 * stack trace with `stderr: null`, which is a poor thing to hit mid-release.
 * `npm` missing entirely is realistic in this bun-first repo.
 */
export function packList() {
  let raw;
  try {
    raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const detail = error?.stderr?.toString().trim() || error?.message || String(error);
    throw new Error(`\`npm pack --dry-run --json\` failed:\n${detail}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`\`npm pack\` did not return JSON:\n${raw.slice(0, 400)}`);
  }

  const [entry] = Array.isArray(parsed) ? parsed : [];
  if (!entry || !Array.isArray(entry.files)) {
    throw new Error('`npm pack` returned no file list — cannot audit the tarball.');
  }
  return entry;
}

export function auditPackage(entry) {
  const problems = [];
  const paths = entry.files.map((file) => file.path);

  const jsMaps = paths.filter((path) => /\.(js|mjs|cjs)\.map$/.test(path));
  if (jsMaps.length > 0) {
    problems.push(
      `${jsMaps.length} JS source map(s) are in the tarball (e.g. ${jsMaps[0]}). ` +
        'They should be excluded by the `!dist/**/*.{js,mjs,cjs}.map` entries in ' +
        '`files` — check whether those were removed.'
    );
  }

  // The invariant that makes dropping the maps safe is `sourcemap: 'hidden'`
  // in both vite configs: no bundle carries a `sourceMappingURL`, so there
  // is nothing for a browser to chase. Without checking it, a revert to
  // `sourcemap: true` — or a third vite config without `'hidden'` — ships
  // bundles pointing at maps that 404, and this guard still exits 0.
  const dangling = paths.filter(
    (path) =>
      /^dist\/.*\.(js|mjs|cjs)$/.test(path) &&
      readSource(resolve(repoRoot, path)).includes('sourceMappingURL=')
  );
  if (dangling.length > 0) {
    problems.push(
      `${dangling.length} shipped bundle(s) still carry a sourceMappingURL comment ` +
        `(e.g. ${dangling[0]}) while the maps are not published. Both vite configs ` +
        "must use `sourcemap: 'hidden'`."
    );
  }

  // Declaration maps are the reason `src` is shipped at all — losing them
  // silently downgrades go-to-definition for every consumer.
  const declarationMaps = paths.filter((path) => path.endsWith('.d.ts.map'));
  if (declarationMaps.length === 0) {
    problems.push('No .d.ts.map files in the tarball — "go to definition" will stop at the stub.');
  }
  if (!paths.some((path) => path.startsWith('src/'))) {
    problems.push('No src/ files in the tarball — the declaration maps point nowhere.');
  }

  if (entry.size > BUDGET.packedBytes) {
    problems.push(`Packed size ${mb(entry.size)} exceeds the ${mb(BUDGET.packedBytes)} budget.`);
  }
  if (entry.unpackedSize > BUDGET.unpackedBytes) {
    problems.push(
      `Unpacked size ${mb(entry.unpackedSize)} exceeds the ${mb(BUDGET.unpackedBytes)} budget.`
    );
  }
  if (entry.entryCount > BUDGET.fileCount) {
    problems.push(`File count ${entry.entryCount} exceeds the ${BUDGET.fileCount} budget.`);
  }

  return { problems, declarationMaps: declarationMaps.length };
}

/**
 * Same injectable shape as `check-full-bundle.mjs` and
 * `check-stability-matrix.mjs`, so `auditPackage` can be exercised from a
 * test without tearing down the test process.
 */
export async function main({ log = console.log, error = console.error, exit } = {}) {
  const terminate = exit ?? process.exit.bind(process);

  if (!existsSync(resolve(repoRoot, 'dist'))) {
    error('✗ No dist/ directory — run `bun run build` first.');
    return terminate(1);
  }

  let entry;
  try {
    entry = packList();
  } catch (failure) {
    error(`✗ ${failure.message}`);
    return terminate(1);
  }

  const { problems, declarationMaps } = auditPackage(entry);

  if (problems.length === 0) {
    log(
      `✓ Package is ${mb(entry.size)} packed / ${mb(entry.unpackedSize)} unpacked across ` +
        `${entry.entryCount} files (${declarationMaps} declaration maps, no JS source maps).`
    );
    return terminate(0);
  }

  error('✗ Published package check failed:');
  for (const problem of problems) error(`  - ${problem}`);
  error('\nSee docs/contributing/release-process.md — "What ships in the tarball".');
  return terminate(1);
}

export function isDirectExecution(argvEntry = process.argv[1]) {
  return Boolean(argvEntry) && import.meta.url === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution()) {
  await main();
}
