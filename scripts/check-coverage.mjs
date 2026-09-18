#!/usr/bin/env bun
/**
 * Enforce the coverage policy in `coverage-policy.mjs` (#215).
 *
 * Bun can enforce a global threshold through `coverageThreshold` in
 * `bunfig.toml`, but only when `coverage = true` is set there too — which
 * turns coverage on for every `bun test` a contributor runs, slowing the
 * ordinary loop. Reading the lcov report keeps the gate in CI where it
 * belongs, and reports per-file numbers alongside it.
 *
 * The global floor is enforced. The per-file floor is reported only: see the
 * note in `coverage-policy.mjs` for the Bun reporter bug that makes per-file
 * numbers untrustworthy in a whole-suite run.
 *
 * Run `bun run test:coverage`, which produces `coverage/lcov.info` first.
 *
 *   bun scripts/check-coverage.mjs           # enforce the global floor
 *   bun scripts/check-coverage.mjs --report  # print the files under the floor
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EXEMPT, FILE_FLOOR, GLOBAL_FLOOR, floorFor, isEnforced } from './coverage-policy.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const lcovPath = resolve(repoRoot, 'coverage', 'lcov.info');

const pct = (hit, found) => (found === 0 ? 100 : (hit / found) * 100);

/**
 * Parse an lcov report into per-file line and function totals.
 *
 * Only the record fields this check needs are read: `SF` (source file),
 * `DA` (line hits), `FNF`/`FNH` (function totals). Bun does not emit `LF`/`LH`
 * summary lines, so lines are counted from the `DA` entries.
 * @internal
 */
export const parseLcov = (source) => {
  const files = [];
  let current = null;

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();

    if (line.startsWith('SF:')) {
      current = {
        path: line.slice(3).replace(/\\/g, '/'),
        linesFound: 0,
        linesHit: 0,
        functionsFound: 0,
        functionsHit: 0,
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith('DA:')) {
      const [, hits] = line.slice(3).split(',');
      current.linesFound++;
      if (Number(hits) > 0) current.linesHit++;
    } else if (line.startsWith('FNF:')) {
      current.functionsFound = Number(line.slice(4)) || 0;
    } else if (line.startsWith('FNH:')) {
      current.functionsHit = Number(line.slice(4)) || 0;
    } else if (line === 'end_of_record') {
      files.push(current);
      current = null;
    }
  }

  if (current) files.push(current);
  return files;
};

/** Reduce parsed records to the numbers the policy talks about. */
export const summarize = (files) => {
  const totals = { linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 };
  const perFile = [];

  for (const file of files) {
    // Only `src/` is subject to the policy — scripts and tests are not the
    // product, and including them would let a well-tested script mask a thin
    // source file.
    if (!file.path.startsWith('src/')) continue;

    totals.linesFound += file.linesFound;
    totals.linesHit += file.linesHit;
    totals.functionsFound += file.functionsFound;
    totals.functionsHit += file.functionsHit;

    perFile.push({
      path: file.path,
      lines: pct(file.linesHit, file.linesFound),
      functions: pct(file.functionsHit, file.functionsFound),
    });
  }

  return {
    global: {
      lines: pct(totals.linesHit, totals.linesFound),
      functions: pct(totals.functionsHit, totals.functionsFound),
    },
    perFile: perFile.sort((a, b) => a.lines - b.lines),
  };
};

export const auditCoverage = (summary) => {
  const problems = [];
  const graduated = [];
  const belowFloor = [];

  if (summary.global.lines < GLOBAL_FLOOR.lines) {
    problems.push(
      `Global line coverage ${summary.global.lines.toFixed(2)}% is below the ${GLOBAL_FLOOR.lines}% floor.`
    );
  }
  if (summary.global.functions < GLOBAL_FLOOR.functions) {
    problems.push(
      `Global function coverage ${summary.global.functions.toFixed(2)}% is below the ${GLOBAL_FLOOR.functions}% floor.`
    );
  }

  const seen = new Set();

  for (const file of summary.perFile) {
    if (!isEnforced(file.path)) continue;
    seen.add(file.path);

    // Reported, not pushed into `problems`: per-file numbers are not
    // trustworthy in a whole-suite run. See coverage-policy.mjs.
    const floor = floorFor(file.path);
    if (file.lines < floor) {
      belowFloor.push(`${file.path} — ${file.lines.toFixed(2)}% lines, below its ${floor}% floor`);
      continue;
    }

    if (Object.hasOwn(EXEMPT, file.path) && file.lines >= FILE_FLOOR) {
      graduated.push(`${file.path} — now ${file.lines.toFixed(2)}%`);
    }
  }

  // An exemption for a file that no longer exists, or that moved out of an
  // enforced module, is stale bookkeeping — and that much is reliable, so it
  // does fail the run.
  for (const path of Object.keys(EXEMPT)) {
    if (!seen.has(path)) {
      problems.push(`${path} — listed in EXEMPT but not found in the coverage report.`);
    }
  }

  return { problems, graduated, belowFloor };
};

export async function main(argv = process.argv.slice(2)) {
  if (!existsSync(lcovPath)) {
    console.error(
      `✗ No coverage report at ${relative(repoRoot, lcovPath)} — run \`bun run test:coverage\` first.`
    );
    process.exit(1);
  }

  const summary = summarize(parseLcov(await readFile(lcovPath, 'utf8')));

  if (argv.includes('--report')) {
    console.log(
      `Global: ${summary.global.lines.toFixed(2)}% lines, ${summary.global.functions.toFixed(2)}% functions\n`
    );
    console.log(`Files under the ${FILE_FLOOR}% line floor:`);
    for (const file of summary.perFile) {
      if (file.lines >= FILE_FLOOR) break;
      const marker = isEnforced(file.path) ? '!' : ' ';
      console.log(`  ${marker} ${file.lines.toFixed(2).padStart(6)}%  ${file.path}`);
    }
    console.log('\n(! = inside a module the per-file floor applies to)');
    process.exit(0);
  }

  const { problems, graduated, belowFloor } = auditCoverage(summary);

  if (belowFloor.length > 0) {
    console.log(`• Below the ${FILE_FLOOR}% per-file floor (reported, not enforced):`);
    for (const entry of belowFloor) console.log(`  - ${entry}`);
    console.log('');
  }

  if (graduated.length > 0) {
    console.log(
      '• These files now clear the floor — drop them from EXEMPT in coverage-policy.mjs:'
    );
    for (const entry of graduated) console.log(`  - ${entry}`);
    console.log('');
  }

  if (problems.length === 0) {
    console.log(
      `✓ Coverage: ${summary.global.lines.toFixed(2)}% lines / ` +
        `${summary.global.functions.toFixed(2)}% functions over src/, ` +
        `clearing the ${GLOBAL_FLOOR.lines}%/${GLOBAL_FLOOR.functions}% floor.`
    );
    process.exit(0);
  }

  console.error('✗ Coverage policy violated:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nSee scripts/coverage-policy.mjs. Add tests rather than lowering a floor.');
  process.exit(1);
}

export function isDirectExecution(argvEntry = process.argv[1]) {
  return Boolean(argvEntry) && import.meta.url === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution()) {
  await main();
}
