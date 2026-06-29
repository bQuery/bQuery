/**
 * Stability-matrix drift guard (#150). Verifies the canonical data plus the
 * three advertised surfaces (STABILITY.md, README, docs introduction) agree.
 */

import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const checkScriptUrl = new URL('../scripts/check-stability-matrix.mjs', import.meta.url).href;
const dataScriptUrl = new URL('../scripts/stability-matrix.mjs', import.meta.url).href;

interface CheckModule {
  auditStabilityMatrix: (options?: { root?: string }) => Promise<{
    problems: string[];
    moduleCount: number;
  }>;
  diff: (label: string, parsed: Map<string, string>, canonical: Map<string, string>) => string[];
}

interface DataModule {
  STABILITY_MATRIX: ReadonlyArray<{ module: string; status: string; targetStable?: string }>;
  statusByModule: () => Map<string, string>;
  modulesByStatus: () => Record<string, string[]>;
}

const { auditStabilityMatrix, diff } = (await import(checkScriptUrl)) as unknown as CheckModule;
const { STABILITY_MATRIX, statusByModule, modulesByStatus } = (await import(
  dataScriptUrl
)) as unknown as DataModule;

describe('stability matrix', () => {
  it('covers every public module exactly once with a valid status', () => {
    const seen = new Set<string>();
    for (const entry of STABILITY_MATRIX) {
      expect(['Stable', 'Beta', 'Experimental']).toContain(entry.status);
      expect(seen.has(entry.module)).toBe(false);
      seen.add(entry.module);
    }
    expect(STABILITY_MATRIX.length).toBe(21);
    expect(modulesByStatus().Stable).toContain('router');
    expect(modulesByStatus().Experimental).toContain('ssr');
  });

  it('is in sync across STABILITY.md, README, and docs introduction', async () => {
    const { problems } = await auditStabilityMatrix({ root: repoRoot });
    expect(problems).toEqual([]);
  });

  it('flags status drift and missing/unexpected modules', () => {
    const canonical = statusByModule();
    const drifted = new Map(canonical);
    drifted.set('router', 'Beta'); // wrong status
    drifted.delete('store'); // missing
    drifted.set('ghost', 'Stable'); // unexpected

    const problems = diff('Source', drifted, canonical);
    expect(problems).toContain('Source: `router` is "Beta" but canonical is "Stable"');
    expect(problems.some((p) => p.includes('missing module `store`'))).toBe(true);
    expect(problems.some((p) => p.includes('unexpected module `ghost`'))).toBe(true);
  });
});
