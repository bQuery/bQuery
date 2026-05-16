import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const checkScriptUrl = new URL('../scripts/check-full-bundle.mjs', import.meta.url).href;
const { auditFullBundle, collectNamedExports, isDirectExecution } = await import(checkScriptUrl);

describe('check-full-bundle script', () => {
  it('parses aliases and type-only specifiers from barrel exports', () => {
    const exports = collectNamedExports(`
      export { foo, localName as publicName, type InlineType } from './runtime';
      export type { TypeOnly, LocalType as PublicType } from './types';
    `);

    expect([...exports.runtime].sort()).toEqual(['foo', 'publicName']);
    expect([...exports.types].sort()).toEqual(['InlineType', 'PublicType', 'TypeOnly']);
    expect([...exports.runtimeSources.get('publicName')!]).toEqual(['./runtime']);
    expect([...exports.typeSources.get('PublicType')!]).toEqual(['./types']);
  });

  it('keeps runtime and type exports aligned with module barrels', () => {
    const result = Bun.spawnSync({
      cmd: [process.execPath, 'scripts/check-full-bundle.mjs'],
      cwd: repoRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.stderr.toString()).toBe('');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(
      'src/full.ts runtime and type exports are in sync with all module barrels'
    );
  });

  it('detects direct execution for relative script paths', () => {
    expect(isDirectExecution('scripts/check-full-bundle.mjs')).toBe(true);
  });

  it('treats unreadable module barrels as audit failures', async () => {
    const result = await auditFullBundle({
      modules: ['broken'],
      readFull: async () => ({
        runtime: new Set<string>(),
        types: new Set<string>(),
        runtimeSources: new Map<string, Set<string>>(),
        typeSources: new Map<string, Set<string>>(),
      }),
      loadModule: async () => {
        throw new Error('boom');
      },
    });

    expect(result.missingRuntime).toEqual([]);
    expect(result.missingTypes).toEqual([]);
    expect(result.skippedModules).toEqual(['broken: boom']);
  });

  it('requires full exports to come from the matching module barrel', async () => {
    const result = await auditFullBundle({
      modules: ['alpha', 'beta'],
      readFull: async () => ({
        runtime: new Set(['shared']),
        types: new Set<string>(),
        runtimeSources: new Map([['shared', new Set(['./beta/index'])]]),
        typeSources: new Map<string, Set<string>>(),
      }),
      loadModule: async (name: string) => ({
        runtime: new Set(['shared']),
        types: new Set<string>(),
        runtimeSources: new Map([['shared', new Set([`./${name}/index`])]]),
        typeSources: new Map<string, Set<string>>(),
      }),
    });

    expect(result.missingRuntime).toEqual(['alpha.shared']);
    expect(result.missingTypes).toEqual([]);
    expect(result.skippedModules).toEqual([]);
  });

  it('accepts convenience re-exports that resolve to the same source module', async () => {
    const result = await auditFullBundle({
      modules: ['reactive', 'view'],
      readFull: async () => ({
        runtime: new Set(['signal']),
        types: new Set<string>(),
        runtimeSources: new Map([['signal', new Set(['./reactive/index'])]]),
        typeSources: new Map<string, Set<string>>(),
      }),
      loadModule: async (name: string) => ({
        runtime: new Set(['signal']),
        types: new Set<string>(),
        runtimeSources: new Map([
          ['signal', new Set([name === 'view' ? '../reactive/index' : './signal'])],
        ]),
        typeSources: new Map<string, Set<string>>(),
      }),
    });

    expect(result.missingRuntime).toEqual([]);
    expect(result.missingTypes).toEqual([]);
    expect(result.skippedModules).toEqual([]);
  });

  it('allows documented cross-module collision omissions', async () => {
    const result = await auditFullBundle({
      modules: ['motion', 'a11y'],
      readFull: async () => ({
        runtime: new Set(['prefersReducedMotion']),
        types: new Set<string>(),
        runtimeSources: new Map([['prefersReducedMotion', new Set(['./motion/index'])]]),
        typeSources: new Map<string, Set<string>>(),
      }),
      loadModule: async (name: string) => ({
        runtime: new Set(['prefersReducedMotion']),
        types: new Set<string>(),
        runtimeSources: new Map([['prefersReducedMotion', new Set([`./${name}/index`])]]),
        typeSources: new Map<string, Set<string>>(),
      }),
    });

    expect(result.missingRuntime).toEqual([]);
    expect(result.missingTypes).toEqual([]);
    expect(result.skippedModules).toEqual([]);
  });
});
