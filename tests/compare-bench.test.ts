import { describe, expect, it } from 'bun:test';

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
  ) => { rows: Row[]; regressions: string[] };
  renderMarkdown: (
    comparison: { rows: Row[]; regressions: string[] },
    threshold?: number
  ) => string;
}

const { DEFAULT_THRESHOLD, compareBenchmarks, renderMarkdown } = (await import(
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

  it('never fails on added, removed or errored benchmarks', () => {
    const { rows, regressions } = compareBenchmarks(
      summary({ removed: { p50: 1, avg: 1 }, broken: { p50: 1, avg: 1 } }),
      summary({ added: { p50: 1, avg: 1 }, broken: { error: 'boom' } })
    );
    expect(regressions).toEqual([]);
    expect(rows.map((row) => row.status).sort()).toEqual(['errored', 'new', 'removed']);
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
});
