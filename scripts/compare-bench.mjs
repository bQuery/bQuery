#!/usr/bin/env bun
/**
 * Compare two benchmark summaries written by `bun run bench --json` (#217).
 *
 *   bun scripts/compare-bench.mjs base.json head.json [--threshold 0.2] [--markdown report.md]
 *   bun scripts/compare-bench.mjs base1.json,base2.json head1.json,head2.json
 *
 * Compares the median (p50) per benchmark and exits with 1 when any benchmark
 * is slower than `base * (1 + threshold)`. Each side may be a comma-separated
 * list of summaries from repeated runs; the middle run per benchmark counts
 * (the lower one of the two middle runs for an even count), so one run that a
 * busy CI neighbour slowed down, or one unusually fast run, cannot decide the
 * gate on either side. The default threshold is generous
 * (20 %) so CI-runner noise does not block merges; a benchmark present on only
 * one side, or one only the base could not run, is reported but never fails
 * the gate. A benchmark that errors on the head fails it. Missing
 * base summaries are skipped with a warning (the base could not run the head's
 * benchmarks); missing head summaries are an error.
 */

import { readFile, writeFile } from 'node:fs/promises';

export const DEFAULT_THRESHOLD = 0.2;

const formatNs = (ns) => {
  if (ns >= 1e9) return `${(ns / 1e9).toFixed(2)} s`;
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`;
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(2)} µs`;
  return `${ns.toFixed(0)} ns`;
};

const formatChange = (ratio) => `${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(1)} %`;

/**
 * Compare two `{ results }` summaries. Returns one row per benchmark name and
 * the names that regressed beyond `threshold`.
 */
export const compareBenchmarks = (base, head, threshold = DEFAULT_THRESHOLD) => {
  const names = [...new Set([...Object.keys(base.results), ...Object.keys(head.results)])].sort();
  const rows = [];
  const regressions = [];
  const failures = [];
  for (const name of names) {
    const before = base.results[name];
    const after = head.results[name];
    if (!before || !after || 'error' in before || 'error' in after) {
      const status = !before ? 'new' : !after ? 'removed' : 'errored';
      // A benchmark the head cannot run is broken; one only the base cannot
      // run (it predates the benchmark) is not the head's fault.
      if (after && 'error' in after) failures.push(name);
      rows.push({ name, status, base: before?.p50, head: after?.p50 });
      continue;
    }
    const ratio = after.p50 / before.p50;
    const status = ratio > 1 + threshold ? 'regressed' : ratio < 1 - threshold ? 'improved' : 'ok';
    if (status === 'regressed') regressions.push(name);
    rows.push({ name, status, base: before.p50, head: after.p50, ratio });
  }
  return { rows, regressions, failures };
};

/**
 * Merge summaries from repeated runs, keeping per benchmark the run with the
 * middle median (the faster of the two middle runs for an even count). A
 * benchmark that errored in at least half of its runs stays errored.
 */
export const mergeSummaries = (summaries) => {
  const runs = {};
  for (const summary of summaries) {
    for (const [name, result] of Object.entries(summary.results)) {
      (runs[name] ??= []).push(result);
    }
  }
  const results = {};
  for (const [name, entries] of Object.entries(runs)) {
    const ok = entries.filter((result) => !('error' in result)).sort((a, b) => a.p50 - b.p50);
    const failed = entries.filter((result) => 'error' in result);
    // A benchmark that failed in at least as many runs as it succeeded counts
    // as errored, so a single lucky run cannot hide a broken benchmark.
    results[name] = ok.length > failed.length ? ok[Math.floor((ok.length - 1) / 2)] : failed[0];
  }
  return { ...summaries[0], results };
};

const ICONS = {
  regressed: '🔴',
  improved: '🟢',
  ok: '⚪',
  new: '🆕',
  removed: '➖',
  errored: '⚠️',
};

/** Render a comparison as a Markdown table. */
export const renderMarkdown = (
  { rows, regressions, failures = [] },
  threshold = DEFAULT_THRESHOLD
) => {
  const lines = [
    `### Benchmarks (median, gate: +${Math.round(threshold * 100)} %)`,
    '',
    '| | Benchmark | Base | Head | Change |',
    '| --- | --- | ---: | ---: | ---: |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${ICONS[row.status]} | ${row.name} | ${row.base === undefined ? '—' : formatNs(row.base)} | ${row.head === undefined ? '—' : formatNs(row.head)} | ${row.ratio === undefined ? row.status : formatChange(row.ratio)} |`
    );
  }
  lines.push(
    '',
    regressions.length === 0
      ? 'No benchmark regressed beyond the threshold.'
      : `**${regressions.length} benchmark(s) regressed beyond the threshold:** ${regressions.join(', ')}`
  );
  if (failures.length > 0) {
    lines.push(
      '',
      `**${failures.length} benchmark(s) failed on the head:** ${failures.join(', ')}`
    );
  }
  return `${lines.join('\n')}\n`;
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const option = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) return undefined;
    const [value] = args.splice(index, 2).slice(1);
    return value;
  };
  const threshold = Number(option('--threshold') ?? DEFAULT_THRESHOLD);
  const markdownPath = option('--markdown');
  const [basePath, headPath] = args;
  if (!basePath || !headPath || !Number.isFinite(threshold) || threshold < 0) {
    console.error(
      'Usage: bun scripts/compare-bench.mjs base.json head.json [--threshold 0.2] [--markdown out.md]'
    );
    process.exit(2);
  }
  // A base run that could not load the head's benchmark files writes no
  // summary; its benchmarks then count as new rather than failing the gate.
  // Every head summary must exist.
  const load = async (paths, { optional }) => {
    const summaries = [];
    for (const path of paths.split(',').filter(Boolean)) {
      try {
        summaries.push(JSON.parse(await readFile(path, 'utf8')));
      } catch (error) {
        if (!optional) throw error;
        console.warn(`Skipping ${path}: ${error instanceof Error ? error.message : error}`);
      }
    }
    return summaries.length > 0 ? mergeSummaries(summaries) : { results: {} };
  };
  const [base, head] = await Promise.all([
    load(basePath, { optional: true }),
    load(headPath, { optional: false }),
  ]);
  const comparison = compareBenchmarks(base, head, threshold);
  const markdown = renderMarkdown(comparison, threshold);
  console.log(markdown);
  if (markdownPath) await writeFile(markdownPath, markdown);
  if (comparison.regressions.length > 0 || comparison.failures.length > 0) process.exit(1);
}
