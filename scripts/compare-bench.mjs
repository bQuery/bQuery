#!/usr/bin/env bun
/**
 * Compare two benchmark summaries written by `bun run bench --json` (#217).
 *
 *   bun scripts/compare-bench.mjs base.json head.json [--threshold 0.2] [--markdown report.md]
 *
 * Compares the median (p50) per benchmark and exits with 1 when any benchmark
 * is slower than `base * (1 + threshold)`. The default threshold is generous
 * (20 %) so CI-runner noise does not block merges; a benchmark present on only
 * one side, or one that errored, is reported but never fails the gate.
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
  for (const name of names) {
    const before = base.results[name];
    const after = head.results[name];
    if (!before || !after || 'error' in before || 'error' in after) {
      const status = !before ? 'new' : !after ? 'removed' : 'errored';
      rows.push({ name, status, base: before?.p50, head: after?.p50 });
      continue;
    }
    const ratio = after.p50 / before.p50;
    const status = ratio > 1 + threshold ? 'regressed' : ratio < 1 - threshold ? 'improved' : 'ok';
    if (status === 'regressed') regressions.push(name);
    rows.push({ name, status, base: before.p50, head: after.p50, ratio });
  }
  return { rows, regressions };
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
export const renderMarkdown = ({ rows, regressions }, threshold = DEFAULT_THRESHOLD) => {
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
  const [base, head] = await Promise.all(
    [basePath, headPath].map(async (path) => JSON.parse(await readFile(path, 'utf8')))
  );
  const comparison = compareBenchmarks(base, head, threshold);
  const markdown = renderMarkdown(comparison, threshold);
  console.log(markdown);
  if (markdownPath) await writeFile(markdownPath, markdown);
  if (comparison.regressions.length > 0) process.exit(1);
}
