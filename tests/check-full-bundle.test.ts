import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const checkScriptUrl = new URL('../scripts/check-full-bundle.mjs', import.meta.url).href;
type CheckFullBundleModule = typeof import('../scripts/check-full-bundle.mjs');

const { auditFullBundle, collectNamedExports } = (await import(checkScriptUrl)) as CheckFullBundleModule;

describe('check-full-bundle script', () => {
  it('parses aliases and type-only specifiers from barrel exports', () => {
    const exports = collectNamedExports(`
      export { foo, localName as publicName, type InlineType } from './runtime';
      export type { TypeOnly, LocalType as PublicType } from './types';
    `);

    expect([...exports.runtime].sort()).toEqual(['foo', 'publicName']);
    expect([...exports.types].sort()).toEqual(['InlineType', 'PublicType', 'TypeOnly']);
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

  it('treats unreadable module barrels as audit failures', async () => {
    const result = await auditFullBundle({
      modules: ['broken'],
      readFull: async () => ({
        runtime: new Set<string>(),
        types: new Set<string>(),
      }),
      loadModule: async () => {
        throw new Error('boom');
      },
    });

    expect(result.missingRuntime).toEqual([]);
    expect(result.missingTypes).toEqual([]);
    expect(result.skippedModules).toEqual(['broken: boom']);
  });
});
