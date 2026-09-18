/**
 * Coverage policy guard (#215). The checker parses lcov itself, so the parser
 * and the audit need their own tests — a coverage gate that miscounts is
 * worse than none.
 */

import { describe, expect, it } from 'bun:test';

const checkUrl = new URL('../scripts/check-coverage.mjs', import.meta.url).href;
const policyUrl = new URL('../scripts/coverage-policy.mjs', import.meta.url).href;

interface FileRecord {
  path: string;
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
}

interface Summary {
  global: { lines: number; functions: number };
  perFile: Array<{ path: string; lines: number; functions: number }>;
}

interface CheckModule {
  parseLcov: (source: string) => FileRecord[];
  summarize: (files: FileRecord[]) => Summary;
  auditCoverage: (summary: Summary) => {
    problems: string[];
    graduated: string[];
    belowFloor: string[];
  };
}

interface PolicyModule {
  GLOBAL_FLOOR: { lines: number; functions: number };
  FILE_FLOOR: number;
  ENFORCED_PREFIXES: string[];
  EXEMPT: Record<string, number>;
  isEnforced: (path: string) => boolean;
  floorFor: (path: string) => number;
}

const { parseLcov, summarize, auditCoverage } = (await import(checkUrl)) as unknown as CheckModule;
const { EXEMPT, FILE_FLOOR, GLOBAL_FLOOR, ENFORCED_PREFIXES, isEnforced, floorFor } = (await import(
  policyUrl
)) as unknown as PolicyModule;

/** Build an lcov record with `hits` of `total` lines covered. */
const record = (path: string, hits: number, total: number, fnHit = 1, fnFound = 1): string =>
  [
    'TN:',
    `SF:${path}`,
    `FNF:${fnFound}`,
    `FNH:${fnHit}`,
    ...Array.from({ length: total }, (_, i) => `DA:${i + 1},${i < hits ? 1 : 0}`),
    'end_of_record',
  ].join('\n');

describe('parseLcov', () => {
  it('reads a single record', () => {
    const [file] = parseLcov(record('src/a.ts', 3, 4, 2, 5));

    expect(file).toEqual({
      path: 'src/a.ts',
      linesFound: 4,
      linesHit: 3,
      functionsFound: 5,
      functionsHit: 2,
    });
  });

  it('reads several records', () => {
    const files = parseLcov([record('src/a.ts', 1, 2), record('src/b.ts', 2, 2)].join('\n'));
    expect(files.map((file) => file.path)).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('normalizes backslash paths', () => {
    const [file] = parseLcov('SF:src\\win\\a.ts\nDA:1,1\nend_of_record');
    expect(file.path).toBe('src/win/a.ts');
  });

  it('counts a line as hit only when its count is above zero', () => {
    const [file] = parseLcov('SF:src/a.ts\nDA:1,0\nDA:2,0\nDA:3,5\nend_of_record');
    expect(file).toMatchObject({ linesFound: 3, linesHit: 1 });
  });

  it('accepts a final record with no end_of_record', () => {
    const files = parseLcov('SF:src/a.ts\nDA:1,1');
    expect(files).toHaveLength(1);
  });

  it('ignores lines before the first SF', () => {
    expect(parseLcov('DA:1,1\nTN:\nSF:src/a.ts\nDA:1,1\nend_of_record')).toHaveLength(1);
  });

  it('returns nothing for an empty report', () => {
    expect(parseLcov('')).toEqual([]);
  });
});

describe('summarize', () => {
  it('aggregates only src/ files', () => {
    const summary = summarize(
      parseLcov(
        [
          record('src/a.ts', 1, 2),
          record('scripts/tool.mjs', 10, 10),
          record('tests/x.test.ts', 10, 10),
        ].join('\n')
      )
    );

    expect(summary.perFile.map((file) => file.path)).toEqual(['src/a.ts']);
    expect(summary.global.lines).toBe(50);
  });

  it('weights the global figure by line count, not by file', () => {
    // 1/100 and 1/1 averages to 50.5% per file, but is 2/101 by line.
    const summary = summarize(
      parseLcov([record('src/big.ts', 1, 100), record('src/small.ts', 1, 1)].join('\n'))
    );

    expect(summary.global.lines).toBeCloseTo((2 / 101) * 100, 5);
  });

  it('sorts files worst-first', () => {
    const summary = summarize(
      parseLcov([record('src/good.ts', 9, 10), record('src/bad.ts', 1, 10)].join('\n'))
    );
    expect(summary.perFile.map((file) => file.path)).toEqual(['src/bad.ts', 'src/good.ts']);
  });

  it('treats a file with no measurable lines as fully covered', () => {
    const summary = summarize([
      { path: 'src/empty.ts', linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 },
    ]);
    expect(summary.perFile[0].lines).toBe(100);
  });
});

describe('auditCoverage', () => {
  /** A summary that satisfies the global floor, plus the given files. */
  const summaryWith = (
    files: Array<{ path: string; lines: number }>,
    global = { lines: 99, functions: 99 }
  ): Summary => ({
    global,
    perFile: [
      ...Object.keys(EXEMPT).map((path) => ({ path, lines: EXEMPT[path], functions: 100 })),
      ...files,
    ].map((file) => ({ functions: 100, ...file })),
  });

  it('passes a healthy report', () => {
    const { problems } = auditCoverage(summaryWith([]));
    expect(problems).toEqual([]);
  });

  it('fails when global line coverage drops below the floor', () => {
    const { problems } = auditCoverage(
      summaryWith([], { lines: GLOBAL_FLOOR.lines - 1, functions: 99 })
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Global line coverage');
  });

  it('fails when global function coverage drops below the floor', () => {
    const { problems } = auditCoverage(
      summaryWith([], { lines: 99, functions: GLOBAL_FLOOR.functions - 1 })
    );
    expect(problems[0]).toContain('Global function coverage');
  });

  it('fails on an EXEMPT entry that is no longer in the report', () => {
    const summary = summaryWith([]);
    summary.perFile = summary.perFile.filter((file) => file.path !== 'src/store/utils.ts');

    const { problems } = auditCoverage(summary);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('src/store/utils.ts');
    expect(problems[0]).toContain('EXEMPT');
  });

  it('reports a thin enforced file without failing the run', () => {
    const { problems, belowFloor } = auditCoverage(
      summaryWith([{ path: 'src/view/thin.ts', lines: 10 }])
    );

    expect(problems).toEqual([]);
    expect(belowFloor).toHaveLength(1);
    expect(belowFloor[0]).toContain('src/view/thin.ts');
  });

  it('ignores a thin file outside the enforced modules', () => {
    const { belowFloor } = auditCoverage(summaryWith([{ path: 'src/motion/flip.ts', lines: 10 }]));
    expect(belowFloor).toEqual([]);
  });

  it('flags an exempt file that has graduated past the floor', () => {
    const summary = summaryWith([]);
    const entry = summary.perFile.find((file) => file.path === 'src/store/utils.ts');
    if (entry) entry.lines = 95;

    const { graduated } = auditCoverage(summary);
    expect(graduated.some((line) => line.includes('src/store/utils.ts'))).toBe(true);
  });

  it('does not treat an exempt file that merely improved as graduated', () => {
    const summary = summaryWith([]);
    const entry = summary.perFile.find((file) => file.path === 'src/store/utils.ts');
    if (entry) entry.lines = FILE_FLOOR - 1;

    const { graduated, problems } = auditCoverage(summary);
    expect(graduated).toEqual([]);
    expect(problems).toEqual([]);
  });
});

describe('coverage policy data', () => {
  it('keeps every EXEMPT path inside an enforced module', () => {
    for (const path of Object.keys(EXEMPT)) {
      expect(isEnforced(path), path).toBe(true);
    }
  });

  it('records every EXEMPT file below the general floor', () => {
    for (const [path, floor] of Object.entries(EXEMPT)) {
      expect(floor, path).toBeLessThan(FILE_FLOOR);
    }
  });

  it('applies the general floor to a non-exempt enforced file', () => {
    expect(floorFor('src/view/mount.ts')).toBe(FILE_FLOOR);
  });

  it('applies the recorded floor to an exempt file', () => {
    expect(floorFor('src/store/utils.ts')).toBe(EXEMPT['src/store/utils.ts']);
  });

  it('scopes enforcement to the five named modules', () => {
    expect(ENFORCED_PREFIXES).toHaveLength(5);
    expect(isEnforced('src/motion/flip.ts')).toBe(false);
    expect(isEnforced('src/security/csp.ts')).toBe(true);
  });
});
