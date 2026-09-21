/**
 * Emit a CommonJS declaration tree alongside the ESM one.
 *
 * `require('@bquery/bquery')` resolves to real CommonJS (the UMD bundle), but
 * with a single `types` entry TypeScript resolved a CJS consumer's *types* to
 * the ESM `dist/index.d.ts`. Because the package is `"type": "module"`, that
 * file is an ES module, so `import { signal } from '@bquery/bquery'` in an
 * `index.cts` failed with:
 *
 *   TS1479: The current file is a CommonJS module whose imports will produce
 *   'require' calls; however, the referenced file is an ECMAScript module.
 *
 * publint and `attw --pack .` both report it as FalseESM / "Masquerading as
 * ESM". The runtime fix in #219 is therefore only half the story: the types
 * have to resolve to a CommonJS declaration too.
 *
 * Copying only the entry declaration is not enough — it pushes the same error
 * one level down, onto its own relative imports. The whole tree has to exist
 * as `.d.cts`, with relative specifiers pointing at `.cjs` so Node16
 * resolution lands on the twin rather than back in the ESM tree. Verified
 * against a real `module: node16` CJS consumer with `skipLibCheck: false`:
 * 24 errors before, 0 after.
 *
 * Runs after `build:types`, so the ESM declarations it copies are final.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(repoRoot, 'dist');

/**
 * A relative import/export specifier in a declaration file.
 *
 * Matches `from './x'`, `import('./x')` and `import './x'` — the three forms
 * `tsc` emits — and deliberately nothing else.
 */
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\2/g;

/** Every `.d.ts` under `dist/`, excluding the twins we write. */
export const collectDeclarations = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectDeclarations(full));
    } else if (entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
};

/**
 * Point a specifier at the CommonJS twin.
 *
 * `tsc` emits extensionless specifiers, and an extensionless one may name
 * either a file or a directory: `./utils` is `./utils.d.ts` in one module and
 * `./utils/index.d.ts` in another. Appending `.cjs` blindly produces
 * `./utils.cjs` for the directory case, which resolves to nothing —
 * `TS2307`. Resolve against disk, preferring a file over a directory exactly
 * as `moduleResolution: Bundler` did for the source.
 *
 * Returns null when neither exists, leaving the specifier alone; a bare
 * package name reaches here too and must not be touched.
 */
export const toCjsSpecifier = (specifier, fromDir, exists = existsSync) => {
  const base = specifier.replace(/\.js$/, '');
  const target = join(fromDir, base);
  if (exists(`${target}.d.ts`)) return `${base}.cjs`;
  if (exists(join(target, 'index.d.ts'))) return `${base}/index.cjs`;
  return null;
};

/** Rewrite one declaration's specifiers for the CommonJS tree. */
export const toCjsDeclaration = (source, fromDir, exists = existsSync) => {
  let changed = 0;
  const output = source.replace(SPECIFIER, (match, prefix, quote, specifier) => {
    const rewritten = toCjsSpecifier(specifier, fromDir, exists);
    if (rewritten === null) return match;
    changed++;
    return `${prefix}${quote}${rewritten}${quote}`;
  });
  return { output, changed };
};

export const emitCjsDeclarations = () => {
  const files = collectDeclarations(distDir);
  let specifiersChanged = 0;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const { output, changed } = toCjsDeclaration(source, dirname(file));
    specifiersChanged += changed;
    writeFileSync(file.replace(/\.d\.ts$/, '.d.cts'), output);
  }

  return { fileCount: files.length, specifiersChanged };
};

export const isDirectExecution = (argv1) =>
  typeof argv1 === 'string' && argv1.endsWith('postbuild-cts.mjs');

export const main = () => {
  if (!existsSync(distDir)) {
    console.error('✗ No dist/ directory — run the type build first.');
    process.exit(1);
  }

  const { fileCount, specifiersChanged } = emitCjsDeclarations();

  // Silently emitting nothing would ship a package whose `require` types
  // resolve into the ESM tree again, with a green build.
  if (fileCount === 0) {
    console.error('✗ No .d.ts files under dist/ — the type build emitted nothing to mirror.');
    process.exit(1);
  }

  console.log(
    `✓ CommonJS declarations: mirrored ${fileCount} file(s), rewriting ${specifiersChanged} specifier(s).`
  );
};

if (isDirectExecution(process.argv[1])) main();
