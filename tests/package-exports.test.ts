/**
 * Guards on the published `exports` map (#219).
 *
 * The map has 25 entries and is hand-edited whenever a module is added, so the
 * invariants that make it resolve correctly are easy to break silently:
 *
 * - `types` must be declared first — conditions resolve in declaration order.
 * - A `require` target must not be a bare `.js` file. This package is
 *   `"type": "module"`, so Node reads `dist/*.js` as ESM; a UMD bundle loaded
 *   that way never runs its CommonJS branch and `require()` hands back an
 *   empty object instead of failing.
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

interface PackageJson {
  main: string;
  module: string;
  types: string;
  unpkg: string;
  jsdelivr: string;
  exports: Record<string, string | Record<string, string>>;
}

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as PackageJson;

const conditionEntries = Object.entries(pkg.exports).filter(
  (entry): entry is [string, Record<string, string>] => typeof entry[1] === 'object'
);

describe('package exports map', () => {
  it('declares `types` first in every entry', () => {
    const offenders = conditionEntries
      .filter(([, conditions]) => Object.keys(conditions)[0] !== 'types')
      .map(([subpath]) => subpath);

    expect(offenders).toEqual([]);
  });

  it('gives every entry a types and an import condition', () => {
    for (const [subpath, conditions] of conditionEntries) {
      expect(conditions.types, `${subpath} types`).toMatch(/^\.\/dist\/.+\.d\.ts$/);
      expect(conditions.import, `${subpath} import`).toMatch(/^\.\/dist\/.+\.mjs$/);
    }
  });

  it('points every `require` condition at a CommonJS file', () => {
    const requireTargets = conditionEntries
      .filter(([, conditions]) => 'require' in conditions)
      .map(([subpath, conditions]) => [subpath, conditions.require] as const);

    // Only the root and `/full` are dual-format; the rest are ESM-only.
    expect(requireTargets.map(([subpath]) => subpath)).toEqual(['.', './full']);

    for (const [subpath, target] of requireTargets) {
      expect(target, `${subpath} require`).toMatch(/\.cjs$/);
    }
  });

  it('resolves `main` to the CommonJS bundle and the CDN fields to the IIFE build', () => {
    expect(pkg.main).toMatch(/\.cjs$/);
    expect(pkg.module).toMatch(/\.mjs$/);
    expect(pkg.unpkg).toBe('./dist/full.iife.js');
    expect(pkg.jsdelivr).toBe('./dist/full.iife.js');
  });

  it('exports ./package.json', () => {
    expect(pkg.exports['./package.json']).toBe('./package.json');
  });
});
