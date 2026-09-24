/**
 * CommonJS declaration twins (#219).
 *
 * `require('@bquery/bquery')` resolves to real CommonJS, but with a single
 * shared `types` entry a `module: node16` CJS consumer resolved its *types*
 * to the ESM `dist/index.d.ts` and failed with TS1479. The build now mirrors
 * the declaration tree to `.d.cts`, with relative specifiers pointing at the
 * `.cjs` twin so Node16 resolution lands inside the CommonJS tree instead of
 * back in the ESM one.
 *
 * Mirroring only the entry declaration is not enough — it moves the same
 * error onto that file's own imports.
 */

import { describe, expect, it } from 'bun:test';

const scriptUrl = new URL('../scripts/postbuild-cts.mjs', import.meta.url).href;

type Exists = (path: string) => boolean;

interface ScriptModule {
  toCjsSpecifier: (specifier: string, fromDir: string, exists?: Exists) => string | null;
  toCjsDeclaration: (
    source: string,
    fromDir: string,
    exists?: Exists
  ) => { output: string; changed: number };
}

const { toCjsSpecifier, toCjsDeclaration } = (await import(scriptUrl)) as unknown as ScriptModule;

/** Pretend `dist/` holds exactly these declaration files. */
const fakeDist = (...paths: string[]): Exists => {
  const present = new Set(paths);
  return (path) => present.has(path.split('\\').join('/'));
};

describe('toCjsSpecifier', () => {
  it('points a file specifier at its .cjs twin', () => {
    const exists = fakeDist('/dist/types.d.ts');
    expect(toCjsSpecifier('./types', '/dist', exists)).toBe('./types.cjs');
  });

  it('resolves a directory specifier through its index', () => {
    // The reason a blind `${specifier}.cjs` does not work: `./utils` is a
    // file in one module and a directory in another, and the directory case
    // would produce `./utils.cjs`, which resolves to nothing (TS2307).
    const exists = fakeDist('/dist/utils/index.d.ts');
    expect(toCjsSpecifier('./utils', '/dist', exists)).toBe('./utils/index.cjs');
  });

  it('prefers a file over a directory of the same name', () => {
    const exists = fakeDist('/dist/utils.d.ts', '/dist/utils/index.d.ts');
    expect(toCjsSpecifier('./utils', '/dist', exists)).toBe('./utils.cjs');
  });

  it('accepts an already-explicit .js specifier', () => {
    // `postbuild-types` runs first and makes specifiers explicit, so both
    // forms reach this script depending on build order.
    const exists = fakeDist('/dist/core/index.d.ts');
    expect(toCjsSpecifier('./core/index.js', '/dist', exists)).toBe('./core/index.cjs');
  });

  it('leaves a specifier alone when neither a file nor a directory matches', () => {
    expect(toCjsSpecifier('./missing', '/dist', fakeDist())).toBeNull();
  });
});

describe('toCjsDeclaration', () => {
  const exists = fakeDist('/dist/core/index.d.ts', '/dist/types.d.ts');

  it('rewrites export-from, import-from, bare import and dynamic import', () => {
    const source = [
      "export * from './core/index';",
      "import type { A } from './types';",
      "import './core/index';",
      "export type B = import('./types').Thing;",
    ].join('\n');

    const result = toCjsDeclaration(source, '/dist', exists);

    expect(result.changed).toBe(4);
    expect(result.output).toBe(
      [
        "export * from './core/index.cjs';",
        "import type { A } from './types.cjs';",
        "import './core/index.cjs';",
        "export type B = import('./types.cjs').Thing;",
      ].join('\n')
    );
  });

  it('leaves bare package specifiers untouched', () => {
    const source = "import type { Foo } from 'some-package';\nexport * from 'node:fs';";
    const result = toCjsDeclaration(source, '/dist', exists);

    expect(result.changed).toBe(0);
    expect(result.output).toBe(source);
  });
});

describe('toCjsDeclaration — multiline specifiers', () => {
  const exists = (path: string) => String(path).endsWith('css.d.ts');
  const out = (result: unknown, fallback: string): string => {
    if (result === null || result === undefined) return fallback;
    const value = result as { output?: string; source?: string };
    return value.output ?? value.source ?? fallback;
  };

  it('rewrites a specifier wrapped across lines', () => {
    // SPECIFIER's `\s*` spans newlines on purpose, so the comment guard must
    // not be applied by splitting the source into lines first — that would
    // silently stop rewriting wrapped dynamic imports.
    const source = ['export type X = import(', "  './css'", ').Css;'].join('\n');
    expect(out(toCjsDeclaration(source, '/dist', exists), source)).toContain('.cjs');
  });

  it('still leaves a specifier inside JSDoc alone', () => {
    const source = [" * {@link import('./css')}", 'export type Y = 1;'].join('\n');
    expect(out(toCjsDeclaration(source, '/dist', exists), source)).toContain(
      "{@link import('./css')}"
    );
  });
});
