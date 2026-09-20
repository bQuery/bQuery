/**
 * Published-tarball guard (#220).
 *
 * The package shipped 11.3 MB unpacked, 6.4 MB of it JS source maps. The
 * exclusion is a one-line `files` change — and a one-line change to undo by
 * accident — so the guard has to keep working. `auditPackage` is a pure
 * function over the `npm pack --json` entry, which is what these exercise;
 * `packList()` itself needs a real `dist/` and is covered by running the
 * script in CI.
 */

import { describe, expect, it } from 'bun:test';

const scriptUrl = new URL('../scripts/check-package-size.mjs', import.meta.url).href;

interface PackEntry {
  files: { path: string }[];
  size: number;
  unpackedSize: number;
  entryCount: number;
}

interface ScriptModule {
  BUDGET: { packedBytes: number; unpackedBytes: number; fileCount: number };
  auditPackage: (entry: PackEntry) => { problems: string[]; declarationMaps: number };
  readSource: (path: string) => string;
}

const { BUDGET, auditPackage } = (await import(scriptUrl)) as unknown as ScriptModule;

/** A pack entry that passes every check, as a baseline to perturb. */
const healthyEntry = (overrides: Partial<PackEntry> = {}): PackEntry => ({
  files: [
    { path: 'dist/index.es.mjs' },
    { path: 'dist/index.d.ts' },
    { path: 'dist/index.d.ts.map' },
    { path: 'src/index.ts' },
    { path: 'package.json' },
  ],
  size: 1_100_000,
  unpackedSize: 4_400_000,
  entryCount: 924,
  ...overrides,
});

describe('auditPackage', () => {
  it('passes a healthy tarball', () => {
    const { problems, declarationMaps } = auditPackage(healthyEntry());
    expect(problems).toEqual([]);
    expect(declarationMaps).toBe(1);
  });

  it('reports JS source maps that slipped back in', () => {
    const entry = healthyEntry({
      files: [...healthyEntry().files, { path: 'dist/index.es.mjs.map' }],
    });

    const { problems } = auditPackage(entry);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('JS source map');
    // The message must point at the cause, not state the opposite.
    expect(problems[0]).toContain('files');
    expect(problems[0]).not.toContain('They are excluded');
  });

  it('reports a tarball with no declaration maps', () => {
    const entry = healthyEntry({
      files: healthyEntry().files.filter((file) => !file.path.endsWith('.d.ts.map')),
    });

    expect(auditPackage(entry).problems).toEqual([
      expect.stringContaining('No .d.ts.map files') as unknown as string,
    ]);
  });

  it('reports a tarball with no src/, since the declaration maps point there', () => {
    const entry = healthyEntry({
      files: healthyEntry().files.filter((file) => !file.path.startsWith('src/')),
    });

    expect(auditPackage(entry).problems).toEqual([
      expect.stringContaining('No src/ files') as unknown as string,
    ]);
  });

  it('reports each budget independently', () => {
    const over = auditPackage(
      healthyEntry({
        size: BUDGET.packedBytes + 1,
        unpackedSize: BUDGET.unpackedBytes + 1,
        entryCount: BUDGET.fileCount + 1,
      })
    );

    expect(over.problems).toHaveLength(3);
    expect(over.problems.join('\n')).toContain('Packed size');
    expect(over.problems.join('\n')).toContain('Unpacked size');
    expect(over.problems.join('\n')).toContain('File count');
  });

  it('accepts a tarball exactly at each budget', () => {
    const atLimit = auditPackage(
      healthyEntry({
        size: BUDGET.packedBytes,
        unpackedSize: BUDGET.unpackedBytes,
        entryCount: BUDGET.fileCount,
      })
    );

    expect(atLimit.problems).toEqual([]);
  });
});
