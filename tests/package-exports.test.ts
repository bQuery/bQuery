/**
 * Guards on the published `exports` map (#219).
 *
 * The map is hand-edited whenever a module is added, so the invariants that
 * make it resolve correctly are easy to break silently:
 *
 * - `types` must come first *within each condition branch* — conditions
 *   resolve in declaration order.
 * - A `require` target must not be a bare `.js` file. This package is
 *   `"type": "module"`, so Node reads `dist/*.js` as ESM; a UMD bundle loaded
 *   that way never runs its CommonJS branch and `require()` hands back an
 *   empty object instead of failing.
 * - A `require` branch needs its own `.d.cts` types. Pointing at the ESM
 *   `.d.ts` makes a `module: node16` CommonJS consumer fail with `TS1479`
 *   even though the runtime resolution is correct.
 * - Every target must exist. The filenames live in two places that have to
 *   agree — this map and `vite.umd.config.ts`'s `fileName` callback — and a
 *   rename in one of them is invisible to a string-only check.
 */

import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

type Conditions = Record<string, string | Record<string, string>>;

interface PackageJson {
  main: string;
  module: string;
  types: string;
  unpkg: string;
  jsdelivr: string;
  exports: Record<string, string | Conditions>;
}

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as PackageJson;

const conditionEntries = Object.entries(pkg.exports).filter(
  (entry): entry is [string, Conditions] => typeof entry[1] === 'object'
);

/** The `{ types, default }` branches of one entry, keyed by condition. */
const branchesOf = (conditions: Conditions): [string, Record<string, string>][] =>
  Object.entries(conditions).filter(
    (entry): entry is [string, Record<string, string>] => typeof entry[1] === 'object'
  );

const distRoot = new URL('../dist/', import.meta.url);
const hasDist = existsSync(distRoot);
const targetExists = (target: string): boolean =>
  existsSync(new URL(`../${target.replace(/^\.\//, '')}`, import.meta.url));

describe('package exports map', () => {
  it('declares `types` first in every condition branch', () => {
    const offenders: string[] = [];

    for (const [subpath, conditions] of conditionEntries) {
      for (const [condition, branch] of branchesOf(conditions)) {
        if (Object.keys(branch)[0] !== 'types') offenders.push(`${subpath} → ${condition}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('gives every entry an import branch with ESM types', () => {
    for (const [subpath, conditions] of conditionEntries) {
      const branches = Object.fromEntries(branchesOf(conditions));
      const importBranch = branches.import;

      expect(importBranch, `${subpath} import`).toBeDefined();
      expect(importBranch?.types, `${subpath} import types`).toMatch(/^\.\/dist\/.+\.d\.ts$/);
      expect(importBranch?.default, `${subpath} import default`).toMatch(/^\.\/dist\/.+\.mjs$/);
    }
  });

  it('points every `require` branch at CommonJS code *and* CommonJS types', () => {
    const withRequire = conditionEntries.filter(([, conditions]) =>
      branchesOf(conditions).some(([condition]) => condition === 'require')
    );

    // Only the root and `/full` are dual-format; the rest are ESM-only.
    expect(withRequire.map(([subpath]) => subpath)).toEqual(['.', './full']);

    for (const [subpath, conditions] of withRequire) {
      const requireBranch = Object.fromEntries(branchesOf(conditions)).require as Record<
        string,
        string
      >;

      expect(requireBranch.default, `${subpath} require default`).toMatch(/\.cjs$/);
      // Not `.d.ts`: that is the ESM declaration, and resolving a CJS
      // consumer's types to it is the FalseESM mismatch publint reports.
      expect(requireBranch.types, `${subpath} require types`).toMatch(/\.d\.cts$/);
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

  it.skipIf(!hasDist)('points every target at a file that exists', () => {
    const targets = new Set<string>([pkg.main, pkg.module, pkg.types, pkg.unpkg, pkg.jsdelivr]);

    for (const [, conditions] of conditionEntries) {
      for (const [, branch] of branchesOf(conditions)) {
        for (const target of Object.values(branch)) targets.add(target);
      }
    }

    const missing = [...targets].filter((target) => !targetExists(target));
    expect(missing).toEqual([]);
  });
});
