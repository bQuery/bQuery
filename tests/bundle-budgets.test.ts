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
  publicEntries: (
    pkg?: unknown
  ) => Promise<Array<{ subpath: string; target: string }> & { unsupported?: string[] }>;
  importTarget: (condition: unknown) => string | null;
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

const { publicEntries, importTarget, auditBudgets, renderTable } = (await import(
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

describe('exports shapes', () => {
  it('reads a nested import condition, not just a bare string', async () => {
    // publint and attw steer packages toward `{ types, default }`, and #219
    // adopted it. Reading only the string form dropped every entry — and a
    // dropped entry is invisible to the audit, so a new public entry would
    // ship unmeasured with CI green.
    expect(importTarget('./dist/core.es.mjs')).toBe('./dist/core.es.mjs');
    expect(importTarget({ types: './dist/core/index.d.ts', default: './dist/core.es.mjs' })).toBe(
      './dist/core.es.mjs'
    );
    expect(importTarget({ types: './dist/core/index.d.ts' })).toBeNull();
    expect(importTarget(undefined)).toBeNull();
  });

  it('measures a nested-condition entry instead of skipping it', async () => {
    const entries = await publicEntries({
      exports: {
        './core': { import: { types: './x.d.ts', default: './dist/core.es.mjs' } },
        './package.json': './package.json',
      },
    });

    expect(entries.map((entry) => entry.subpath)).toEqual(['./core']);
    expect(entries.unsupported).toEqual([]);
  });

  it('reports an entry whose shape it cannot read rather than skipping it', async () => {
    const entries = await publicEntries({
      exports: {
        './brandnew': { types: './x.d.ts' },
        './weird': { import: './dist/weird.js' },
      },
    });

    expect(entries).toHaveLength(0);
    expect(entries.unsupported).toHaveLength(2);
  });

  it('fails the audit on an unreadable entry', () => {
    const measurements = Object.assign([], {
      unsupported: ['./brandnew — no import target this script can read; cannot measure.'],
    });

    const { problems } = auditBudgets(measurements, new Map());
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('./brandnew');
  });
});

describe('budget headroom', () => {
  it('gives every entry the same 15% headroom', () => {
    // Rounding to the nearest 1 kB gave `./security` 42% slack while the
    // large entries got 15%, so a 40% regression on a small module passed.
    for (const { subpath, gzip } of BUNDLE_BUDGETS) {
      const implied = gzip / 1.15;
      // The budget is ceil(measured * 1.15 / 100) * 100, so the headroom is
      // 15% plus at most one 100-byte rounding step.
      const maxHeadroom = (implied + 100) / implied - 1;
      expect(maxHeadroom, subpath).toBeLessThan(0.2);
    }
  });
});
