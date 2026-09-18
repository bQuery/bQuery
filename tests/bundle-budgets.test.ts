/**
 * Bundle-size budget guard (#216).
 *
 * The budget data has to stay in step with the `exports` map — an entry point
 * with no budget is exactly the regression path this check exists to close —
 * and the audit has to fail on the three ways that can go wrong: over budget,
 * unbudgeted entry, and a budget left behind after an entry is removed.
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

const checkUrl = new URL('../scripts/check-bundle-size.mjs', import.meta.url).href;
const dataUrl = new URL('../scripts/bundle-budgets.mjs', import.meta.url).href;

interface Measurement {
  subpath: string;
  target?: string;
  minified?: number;
  gzip?: number;
  missing?: boolean;
}

interface CheckModule {
  publicEntries: (pkg?: unknown) => Promise<Array<{ subpath: string; target: string }>>;
  auditBudgets: (
    measurements: Measurement[],
    budgets?: Map<string, number>
  ) => { problems: string[]; unbudgeted: string[]; stale: string[] };
  renderTable: (measurements: Measurement[], budgets?: Map<string, number>) => string;
}

interface DataModule {
  BUNDLE_BUDGETS: ReadonlyArray<{ subpath: string; gzip: number; note?: string }>;
  budgetBySubpath: () => Map<string, number>;
}

const { publicEntries, auditBudgets, renderTable } = (await import(
  checkUrl
)) as unknown as CheckModule;
const { BUNDLE_BUDGETS, budgetBySubpath } = (await import(dataUrl)) as unknown as DataModule;

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  exports: Record<string, unknown>;
};

describe('bundle budget data', () => {
  it('lists every subpath exactly once with a positive budget', () => {
    const seen = new Set<string>();
    for (const entry of BUNDLE_BUDGETS) {
      expect(seen.has(entry.subpath)).toBe(false);
      seen.add(entry.subpath);
      expect(entry.gzip).toBeGreaterThan(0);
    }
  });

  it('covers every public ESM entry point in the exports map', async () => {
    const entries = await publicEntries(pkg);
    const budgets = budgetBySubpath();

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(budgets.has(entry.subpath), `missing budget for ${entry.subpath}`).toBe(true);
    }
    expect(budgets.size).toBe(entries.length);
  });

  it('skips ./package.json, which has no bundle', async () => {
    const entries = await publicEntries(pkg);
    expect(entries.some((entry) => entry.subpath === './package.json')).toBe(false);
  });
});

describe('auditBudgets', () => {
  const budgets = new Map([['./core', 10000]]);

  it('passes an entry under budget', () => {
    const { problems } = auditBudgets([{ subpath: './core', gzip: 9000 }], budgets);
    expect(problems).toEqual([]);
  });

  it('passes an entry exactly at budget', () => {
    const { problems } = auditBudgets([{ subpath: './core', gzip: 10000 }], budgets);
    expect(problems).toEqual([]);
  });

  it('fails an entry over budget and reports the overage', () => {
    const { problems } = auditBudgets([{ subpath: './core', gzip: 12000 }], budgets);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('./core');
    expect(problems[0]).toContain('20.0%');
  });

  it('fails an entry point with no budget', () => {
    const { problems, unbudgeted } = auditBudgets(
      [
        { subpath: './core', gzip: 9000 },
        { subpath: './brand-new', gzip: 100 },
      ],
      budgets
    );
    expect(unbudgeted).toEqual(['./brand-new']);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('no budget');
  });

  it('fails a budget left behind after the entry point is removed', () => {
    const { problems, stale } = auditBudgets([], budgets);
    expect(stale).toEqual(['./core']);
    expect(problems[0]).toContain('no longer a public entry point');
  });

  it('fails when the build output is missing', () => {
    const { problems } = auditBudgets(
      [{ subpath: './core', target: './dist/core.es.mjs', missing: true }],
      budgets
    );
    expect(problems[0]).toContain('missing');
  });
});

describe('renderTable', () => {
  it('renders the root entry as the bare package name', () => {
    const table = renderTable(
      [{ subpath: '.', minified: 1024, gzip: 512 }],
      new Map([['.', 1000]])
    );
    expect(table).toContain('`@bquery/bquery`');
    expect(table).toContain('1.0 kB');
    expect(table).toContain('**0.5 kB**');
  });

  it('renders a sub-path as a full specifier and skips missing entries', () => {
    const table = renderTable(
      [
        { subpath: './core', minified: 2048, gzip: 1024 },
        { subpath: './gone', missing: true },
      ],
      new Map([['./core', 2000]])
    );
    expect(table).toContain('`@bquery/bquery/core`');
    expect(table).not.toContain('gone');
  });
});
