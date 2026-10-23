/**
 * Benchmark runner (#217).
 *
 *   bun run bench                         # print results
 *   bun run bench --json bench.json       # also write a JSON summary
 *   bun run bench --filter "deep chain"   # only names containing the text
 *
 * The JSON summary maps each benchmark name to its median (p50) and mean time
 * per iteration in nanoseconds; `scripts/compare-bench.mjs` compares two of
 * them and fails on regressions.
 */

import { writeFile } from 'node:fs/promises';
import { run } from 'mitata';
import './reactive.bench';
import './view.bench';
import './ssr.bench';

const argValue = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

const jsonPath = argValue('--json');
const filter = argValue('--filter');

// A literal, case-insensitive substring match: the CLI value is text, not a pattern.
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const { benchmarks, context } = await run({
  filter: filter ? new RegExp(escapeRegExp(filter), 'i') : undefined,
  throw: false,
});

const results: Record<string, { p50: number; avg: number } | { error: string }> = {};
for (const trial of benchmarks) {
  for (const entry of trial.runs) {
    results[entry.name] = entry.stats
      ? { p50: entry.stats.p50, avg: entry.stats.avg }
      : { error: entry.error instanceof Error ? entry.error.message : String(entry.error) };
  }
}

if (jsonPath) {
  const summary = {
    runtime: context.runtime,
    arch: context.arch,
    cpu: context.cpu.name,
    date: new Date(context.now).toISOString(),
    results,
  };
  await writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\nWrote ${Object.keys(results).length} results to ${jsonPath}`);
}

if (Object.values(results).some((result) => 'error' in result)) {
  console.error('\nSome benchmarks failed — see the errors above.');
  process.exitCode = 1;
}
