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

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
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
 * `DA` (line hits), `FNF`/`FNH` (function totals). `LF`/`LH` are ignored even
 * though Bun does emit them: deriving line totals from the `DA` entries keeps
 * one source of truth in the parser. (Verified across all 270 records in the
 * report this check generates — the derived counts match `LF`/`LH` exactly.)
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

/**
 * Whether a source file declares anything that can be executed.
 *
 * A type-only module (`types.ts` and friends — 19 of them here) legitimately
 * produces no coverage record, so requiring one would be wrong. Anything
 * that declares a value, function or class does produce one the moment a
 * test loads it, so its absence means no test loads it.
 * @internal
 */
export const hasRuntimeCode = (source) => {
  const body = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // `export async function` and `export enum` both emit runtime code and both
  // occur in src/, so a file holding only those would otherwise slip past the
  // ratchet untested. `export default` counts too, unless it is a type-only
  // default (`interface`/`type`), which emits nothing.
  return /(^|\n)\s*(?:(?:export\s+)?(?:async\s+)?(?:const|let|var|function|class|enum)\b|export\s+default\s+(?!interface\b|type\b)\S)/.test(
    body
  );
};

/** Every `.ts` file under `src/`, repo-relative and slash-separated. */
export const collectSourceFiles = (dir = resolve(repoRoot, 'src')) => {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collectSourceFiles(full));
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      found.push(relative(repoRoot, full).split('\\').join('/'));
    }
  }
  return found;
};

/**
 * Source files with runtime code that the report does not mention at all.
 * @internal
 */
export const unreportedSources = (summary, sources = collectSourceFiles(), read = readFileSync) => {
  const reported = new Set(summary.perFile.map((file) => file.path));
  return sources.filter((path) => {
    if (reported.has(path)) return false;
    try {
      return hasRuntimeCode(read(resolve(repoRoot, path), 'utf8'));
    } catch {
      return false;
    }
  });
};

export const auditCoverage = (summary, unreported = []) => {
  const problems = [];
  const graduated = [];
  const belowFloor = [];

  // Bun's lcov only records modules some test loaded — there is no
  // `c8 --all`. So a brand-new, entirely untested module is not in the
  // report at all, and the global floor cannot see it: it passes at any
  // size. The mirror image is worse — deleting the only test that imports a
  // thin file *raises* the global figure, because its uncovered lines leave
  // the denominator. Both invert "coverage can only go up", so a source file
  // with runtime code that never appears in the report is a failure.
  for (const path of unreported) {
    problems.push(`${path} — has runtime code but no coverage record; no test loads it.`);
  }

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
    if (seen.has(path)) continue;
    // `seen` only collects enforced paths, so an entry outside
    // ENFORCED_PREFIXES is present in the report yet absent here. Saying
    // "not found in the coverage report" would send the reader looking for
    // a file that is right there.
    const reason = isEnforced(path)
      ? 'not found in the coverage report'
      : 'not inside any ENFORCED_PREFIXES module';
    problems.push(`${path} — listed in EXEMPT but ${reason}.`);
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

  const { problems, graduated, belowFloor } = auditCoverage(summary, unreportedSources(summary));

  if (belowFloor.length > 0) {
    // Entries are compared against each file's own recorded floor, not the
    // shared FILE_FLOOR, so the heading has to say so.
    console.log('• Below its recorded per-file floor (reported, not enforced):');
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
