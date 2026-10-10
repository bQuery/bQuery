import { describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface Summary {
  results: Record<string, { p50: number; avg: number } | { error: string }>;
}
interface Row {
  name: string;
  status: string;
  base?: number;
  head?: number;
  ratio?: number;
}
interface CompareBenchModule {
  DEFAULT_THRESHOLD: number;
  compareBenchmarks: (
    base: Summary,
    head: Summary,
    threshold?: number
  ) => { rows: Row[]; regressions: string[]; failures: string[] };
  renderMarkdown: (
    comparison: { rows: Row[]; regressions: string[]; failures?: string[] },
    threshold?: number
  ) => string;
  mergeSummaries: (summaries: Summary[]) => Summary;
}

const { DEFAULT_THRESHOLD, compareBenchmarks, mergeSummaries, renderMarkdown } = (await import(
  new URL('../scripts/compare-bench.mjs', import.meta.url).href
)) as CompareBenchModule;

const summary = (results: Summary['results']): Summary => ({ results });

describe('compare-bench (#217)', () => {
  it('defaults to a generous 20 % gate', () => {
    expect(DEFAULT_THRESHOLD).toBe(0.2);
  });

  it('flags only medians slower than the threshold', () => {
    const { rows, regressions } = compareBenchmarks(
      summary({
        same: { p50: 100, avg: 100 },
        noisy: { p50: 100, avg: 100 },
        slower: { p50: 100, avg: 100 },
        faster: { p50: 100, avg: 100 },
      }),
      summary({
        same: { p50: 100, avg: 100 },
        noisy: { p50: 119, avg: 140 },
        slower: { p50: 125, avg: 90 },
        faster: { p50: 70, avg: 70 },
      })
    );
    expect(regressions).toEqual(['slower']);
    expect(Object.fromEntries(rows.map((row) => [row.name, row.status]))).toEqual({
      faster: 'improved',
      noisy: 'ok',
      same: 'ok',
      slower: 'regressed',
    });
  });

  it('does not fail on added, removed or base-only errored benchmarks', () => {
    const { rows, regressions, failures } = compareBenchmarks(
      summary({ removed: { p50: 1, avg: 1 }, predates: { error: 'not defined' } }),
      summary({ added: { p50: 1, avg: 1 }, predates: { p50: 1, avg: 1 } })
    );
    expect(regressions).toEqual([]);
    expect(failures).toEqual([]);
    expect(rows.map((row) => row.status).sort()).toEqual(['errored', 'new', 'removed']);
  });

  it('fails on a benchmark that errors on the head', () => {
    const comparison = compareBenchmarks(
      summary({ broken: { p50: 1, avg: 1 } }),
      summary({ broken: { error: 'boom' } })
    );
    expect(comparison.regressions).toEqual([]);
    expect(comparison.failures).toEqual(['broken']);
    expect(renderMarkdown(comparison)).toContain('failed on the head:** broken');
  });

  it('honours a custom threshold', () => {
    const base = summary({ a: { p50: 100, avg: 100 } });
    const head = summary({ a: { p50: 106, avg: 106 } });
    expect(compareBenchmarks(base, head, 0.05).regressions).toEqual(['a']);
    expect(compareBenchmarks(base, head).regressions).toEqual([]);
  });

  it('renders a Markdown report', () => {
    const markdown = renderMarkdown(
      compareBenchmarks(
        summary({ fast: { p50: 1_500, avg: 1_500 }, slow: { p50: 2e6, avg: 2e6 } }),
        summary({ fast: { p50: 1_500, avg: 1_500 }, slow: { p50: 3e6, avg: 3e6 } })
      )
    );
    expect(markdown).toContain('| 🔴 | slow | 2.00 ms | 3.00 ms | +50.0 % |');
    expect(markdown).toContain('| ⚪ | fast | 1.50 µs | 1.50 µs | +0.0 % |');
    expect(markdown).toContain('regressed beyond the threshold:** slow');
  });

  it('merges repeated runs by keeping the middle run', () => {
    const merged = mergeSummaries([
      summary({ a: { p50: 120, avg: 130 }, b: { error: 'flaky' } }),
      summary({ a: { p50: 100, avg: 140 }, b: { p50: 50, avg: 55 } }),
      summary({ a: { p50: 110, avg: 110 }, b: { p50: 60, avg: 60 } }),
    ]);
    expect(merged.results).toEqual({ a: { p50: 110, avg: 110 }, b: { p50: 50, avg: 55 } });
  });

  it('keeps a benchmark errored when it failed in at least half of its runs', () => {
    const merged = mergeSummaries([
      summary({ a: { error: 'boom' } }),
      summary({ a: { p50: 100, avg: 100 } }),
      summary({ a: { error: 'boom again' } }),
    ]);
    expect(merged.results).toEqual({ a: { error: 'boom' } });
  });

  it('keeps an errored benchmark when no run succeeded', () => {
    const merged = mergeSummaries([
      summary({ a: { error: 'boom' } }),
      summary({ a: { error: 'again' } }),
    ]);
    expect(merged.results).toEqual({ a: { error: 'boom' } });
  });

  it('does not flag a regression because one base run was unusually fast', () => {
    const base = mergeSummaries([
      summary({ a: { p50: 100, avg: 100 } }),
      summary({ a: { p50: 70, avg: 70 } }),
      summary({ a: { p50: 102, avg: 102 } }),
    ]);
    const head = mergeSummaries([
      summary({ a: { p50: 105, avg: 105 } }),
      summary({ a: { p50: 108, avg: 108 } }),
      summary({ a: { p50: 101, avg: 101 } }),
    ]);
    expect(compareBenchmarks(base, head).regressions).toEqual([]);
  });

  it('still flags a regression that shows in most runs', () => {
    const base = mergeSummaries([
      summary({ a: { p50: 100, avg: 100 } }),
      summary({ a: { p50: 98, avg: 98 } }),
      summary({ a: { p50: 103, avg: 103 } }),
    ]);
    const head = mergeSummaries([
      summary({ a: { p50: 130, avg: 130 } }),
      summary({ a: { p50: 100, avg: 100 } }),
      summary({ a: { p50: 128, avg: 128 } }),
    ]);
    expect(compareBenchmarks(base, head).regressions).toEqual(['a']);
  });

  it('does not flag a noisy run when another run of the same side is fast', () => {
    const base = mergeSummaries([summary({ a: { p50: 100, avg: 100 } })]);
    const head = mergeSummaries([
      summary({ a: { p50: 130, avg: 130 } }),
      summary({ a: { p50: 104, avg: 104 } }),
    ]);
    expect(compareBenchmarks(base, head).regressions).toEqual([]);
  });

  it('skips missing base summaries but requires the head summaries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bench-'));
    const head = join(dir, 'head.json');
    await writeFile(head, JSON.stringify(summary({ a: { p50: 1, avg: 1 } })));
    const run = (...args: string[]) =>
      Bun.spawnSync([process.execPath, 'scripts/compare-bench.mjs', ...args], {
        cwd: new URL('..', import.meta.url).pathname,
      });

    // The base could not load the head's benchmarks and wrote nothing.
    const missingBase = run(`${join(dir, 'base-1.json')},${join(dir, 'base-2.json')}`, head);
    expect(missingBase.exitCode).toBe(0);
    expect(missingBase.stdout.toString()).toContain('| 🆕 | a |');

    const missingHead = run(head, join(dir, 'nope.json'));
    expect(missingHead.exitCode).not.toBe(0);
    await rm(dir, { recursive: true, force: true });
  });
});
