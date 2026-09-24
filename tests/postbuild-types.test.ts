/**
 * Declaration-extension rewrite (#218).
 *
 * `tsc` emits relative specifiers exactly as the source writes them, and this
 * codebase writes them extensionless. Under `moduleResolution: node16`/
 * `nodenext` that is a hard TS2834 for any consumer with `skipLibCheck: false`
 * — 315 problems by `attw`'s count. The build rewrites them on the way out.
 */

import { describe, expect, it } from 'bun:test';

const scriptUrl = new URL('../scripts/postbuild-types.mjs', import.meta.url).href;

type Exists = (path: string) => boolean;

interface ScriptModule {
  resolveSpecifier: (specifier: string, fromDir: string, exists?: Exists) => string | null;
  rewriteSource: (
    source: string,
    fromDir: string,
    exists?: Exists
  ) => { source: string; changed: number } | null;
}

const { resolveSpecifier, rewriteSource } = (await import(scriptUrl)) as unknown as ScriptModule;

/** Pretend `dist/` holds exactly these declaration files. */
const fakeDist = (...paths: string[]): Exists => {
  const present = new Set(paths);
  return (path) => present.has(path.split('\\').join('/'));
};

describe('resolveSpecifier', () => {
  it('appends .js when a sibling declaration exists', () => {
    const exists = fakeDist('/dist/core/index.d.ts');
    expect(resolveSpecifier('./core/index', '/dist', exists)).toBe('./core/index.js');
  });

  it('appends /index.js when the specifier names a directory', () => {
    const exists = fakeDist('/dist/core/index.d.ts');
    expect(resolveSpecifier('./core', '/dist', exists)).toBe('./core/index.js');
  });

  it('prefers the sibling file over the directory of the same name', () => {
    const exists = fakeDist('/dist/core.d.ts', '/dist/core/index.d.ts');
    expect(resolveSpecifier('./core', '/dist', exists)).toBe('./core.js');
  });

  it('resolves parent-relative specifiers against the importing directory', () => {
    const exists = fakeDist('/dist/reactive/index.d.ts');
    expect(resolveSpecifier('../reactive/index', '/dist/view', exists)).toBe(
      '../reactive/index.js'
    );
  });

  it('leaves specifiers that already carry an extension alone', () => {
    const exists = fakeDist('/dist/core/index.d.ts');
    for (const specifier of ['./core/index.js', './data.json', './native.node', './x.mjs']) {
      expect(resolveSpecifier(specifier, '/dist', exists)).toBeNull();
    }
  });

  it('leaves specifiers that resolve to nothing alone', () => {
    expect(resolveSpecifier('./missing', '/dist', fakeDist())).toBeNull();
  });
});

describe('rewriteSource', () => {
  const exists = fakeDist('/dist/core/index.d.ts', '/dist/types.d.ts');

  it('rewrites export-from, import-from, bare import and dynamic import', () => {
    const source = [
      "export * from './core/index';",
      "import type { A } from './types';",
      "import './core/index';",
      "export type B = import('./types').Thing;",
    ].join('\n');

    const result = rewriteSource(source, '/dist', exists);

    expect(result).not.toBeNull();
    expect(result?.changed).toBe(4);
    expect(result?.source).toBe(
      [
        "export * from './core/index.js';",
        "import type { A } from './types.js';",
        "import './core/index.js';",
        "export type B = import('./types.js').Thing;",
      ].join('\n')
    );
  });

  it('handles double-quoted specifiers', () => {
    const result = rewriteSource('export * from "./types";', '/dist', exists);
    expect(result?.source).toBe('export * from "./types.js";');
  });

  it('leaves bare package specifiers untouched', () => {
    const source = "import type { Foo } from 'some-package';\nexport * from 'node:fs';";
    expect(rewriteSource(source, '/dist', exists)).toBeNull();
  });

  it('returns null when there is nothing to change', () => {
    expect(rewriteSource("export * from './core/index.js';", '/dist', exists)).toBeNull();
  });

  it('leaves specifiers inside JSDoc alone', () => {
    // The pass is otherwise comment-blind. Harmless for a `{@link}`, but an
    // `@example` showing consumer code would be rewritten to bQuery's
    // internal dist layout and shipped into IDE hover docs.
    const source = [
      '/**',
      " * Can be either a plain string or a {@link import('./types').Thing}.",
      ' *',
      ' * @example',
      " * import { thing } from './core/index';",
      ' */',
      "export * from './core/index';",
    ].join('\n');

    const result = rewriteSource(source, '/dist', exists);

    expect(result?.changed).toBe(1);
    expect(result?.source).toContain("{@link import('./types').Thing}");
    expect(result?.source).toContain(" * import { thing } from './core/index';");
    expect(result?.source).toContain("export * from './core/index.js';");
  });

  it('still rewrites a line-comment-free statement that follows a comment', () => {
    const source = ["// keep './types' as written", "export * from './types';"].join('\n');

    const result = rewriteSource(source, '/dist', exists);

    expect(result?.changed).toBe(1);
    expect(result?.source).toBe(
      ["// keep './types' as written", "export * from './types.js';"].join('\n')
    );
  });
});

describe('rewriteSource — multiline specifiers', () => {
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
    expect(out(rewriteSource(source, '/dist', exists), source)).toContain('.js');
  });

  it('still leaves a specifier inside JSDoc alone', () => {
    const source = [" * {@link import('./css')}", 'export type Y = 1;'].join('\n');
    expect(out(rewriteSource(source, '/dist', exists), source)).toContain(
      "{@link import('./css')}"
    );
  });
});
