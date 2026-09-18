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
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');

/** Ceilings, with headroom over the measured 1.1 MB / 4.6 MB / 924 files. */
export const BUDGET = {
  packedBytes: 1.6 * 1024 * 1024,
  unpackedBytes: 6 * 1024 * 1024,
  fileCount: 1100,
};

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/** Ask npm what it would publish. */
export function packList() {
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
  const [entry] = JSON.parse(raw);
  return entry;
}

export function auditPackage(entry) {
  const problems = [];
  const paths = entry.files.map((file) => file.path);

  const jsMaps = paths.filter((path) => /\.(js|mjs|cjs)\.map$/.test(path));
  if (jsMaps.length > 0) {
    problems.push(
      `${jsMaps.length} JS source map(s) are in the tarball (e.g. ${jsMaps[0]}). ` +
        'They are excluded via `files` in package.json.'
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

export async function main() {
  if (!existsSync(resolve(repoRoot, 'dist'))) {
    console.error('✗ No dist/ directory — run `bun run build` first.');
    process.exit(1);
  }

  const entry = packList();
  const { problems, declarationMaps } = auditPackage(entry);

  if (problems.length === 0) {
    console.log(
      `✓ Package is ${mb(entry.size)} packed / ${mb(entry.unpackedSize)} unpacked across ` +
        `${entry.entryCount} files (${declarationMaps} declaration maps, no JS source maps).`
    );
    process.exit(0);
  }

  console.error('✗ Published package check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nSee docs/contributing/release-process.md — "What ships in the tarball".');
  process.exit(1);
}

export function isDirectExecution(argvEntry = process.argv[1]) {
  return Boolean(argvEntry) && import.meta.url === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution()) {
  await main();
}
