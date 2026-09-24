#!/usr/bin/env bun
/**
 * Add explicit `.js` extensions to relative imports in the emitted `.d.ts`
 * files, so the published types resolve the way consumers actually load them
 * (#218).
 *
 * `tsc` re-emits relative specifiers exactly as the source writes them, and
 * this codebase writes them extensionless (`export * from './core/index'`).
 * That is fine for a bundler, but this is an ESM package, and under
 * `moduleResolution: node16`/`nodenext` ESM resolution requires an explicit
 * extension. A consumer with `skipLibCheck: false` gets a wall of TS2834:
 *
 *   dist/index.d.ts(10,15): error TS2834: Relative import paths need explicit
 *   file extensions in ECMAScript imports ...
 *
 * `attw` reports the same thing as 315 InternalResolutionError problems.
 * Most projects run `skipLibCheck: true`, which is why it went unnoticed.
 *
 * The real fix is extensions in the source imports, but that touches every
 * file in `src/`. Rewriting the emitted declarations gets the same result for
 * consumers, and only the declarations need it — Vite already resolves the
 * runtime bundles.
 *
 * Only specifiers that resolve to a file actually present in `dist/` are
 * rewritten; anything else is left alone.
 *
 * Usage: bun scripts/postbuild-types.mjs
 */

import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const distDir = join(repoRoot, 'dist');

/** `from '…'`, `import('…')` and bare `import '…'`, single or double quoted. */
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]*)\2/g;

/**
 * A line that is comment text rather than code.
 *
 * The rewrite is otherwise comment-blind, and that is not hypothetical: it
 * turned `{@link import('./css')}` in `src/component/types.ts` into
 * `'./css.js'` in the emitted declaration. Harmless there, but an `@example`
 * block showing *consumer* code — `from './core'` — would be rewritten to
 * bQuery's internal dist layout and shipped into IDE hover docs.
 *
 * Applied without splitting the source: `SPECIFIER`'s `\\s*` and `\\s+` match
 * newlines, so a wrapped `import(\\n  './x')` only matches against the whole
 * text. Splitting into lines to skip comments would silently stop rewriting
 * those, which is a rewrite that fails quietly rather than loudly.
 */
const commentRanges = (source) => {
  const ranges = [];
  let offset = 0;
  for (const line of source.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      ranges.push([offset, offset + line.length]);
    }
    offset += line.length + 1;
  }
  return ranges;
};

/** Whether an offset falls inside a comment line. */
const inComment = (ranges, index) => ranges.some(([start, end]) => index >= start && index < end);

/** Already has an extension we must not touch. */
const HAS_EXTENSION = /\.(js|mjs|cjs|json|node)$/;

/** Collect every `.d.ts` under a directory. */
export async function collectDeclarations(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collectDeclarations(path)));
    else if (entry.name.endsWith('.d.ts')) found.push(path);
  }
  return found;
}

/**
 * Resolve an extensionless relative specifier the way Node ESM would need it
 * written. Returns the rewritten specifier, or null to leave it alone.
 */
export function resolveSpecifier(specifier, fromDir, exists = existsSync) {
  if (HAS_EXTENSION.test(specifier)) return null;

  const target = join(fromDir, specifier);
  if (exists(`${target}.d.ts`)) return `${specifier}.js`;
  if (exists(join(target, 'index.d.ts'))) return `${specifier}/index.js`;
  return null;
}

/** Rewrite one declaration file's specifiers. Returns the new source, or null. */
export function rewriteSource(source, fromDir, exists = existsSync) {
  let changed = 0;
  const ranges = commentRanges(source);
  const next = source.replace(SPECIFIER, (match, keyword, quote, specifier, index) => {
    if (inComment(ranges, index)) return match;
    const rewritten = resolveSpecifier(specifier, fromDir, exists);
    if (rewritten === null) return match;
    changed++;
    return `${keyword}${quote}${rewritten}${quote}`;
  });
  return changed > 0 ? { source: next, changed } : null;
}

export async function fixDeclarationExtensions() {
  const files = await collectDeclarations(distDir);
  let filesChanged = 0;
  let specifiersChanged = 0;

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const result = rewriteSource(source, dirname(file));
    if (!result) continue;
    await writeFile(file, result.source);
    filesChanged++;
    specifiersChanged += result.changed;
  }

  return { fileCount: files.length, filesChanged, specifiersChanged };
}

export async function main() {
  if (!existsSync(distDir)) {
    console.error('✗ No dist/ directory — run the type build first.');
    process.exit(1);
  }

  const { fileCount, filesChanged, specifiersChanged } = await fixDeclarationExtensions();

  // Finding nothing is a build problem, not a no-op. A changed `outDir` or a
  // `vite build` with `emptyOutDir` reordered after `build:types` would leave
  // the declarations unrewritten and ship the extensionless imports this
  // script exists to fix — with `bun run build` still green. The same rule
  // `check:full-bundle` states: silently skipping is not allowed.
  if (fileCount === 0) {
    console.error('✗ No .d.ts files under dist/ — the type build emitted nothing to rewrite.');
    process.exit(1);
  }

  console.log(
    `✓ Declaration imports: rewrote ${specifiersChanged} specifier(s) across ` +
      `${filesChanged} of ${fileCount} .d.ts files.`
  );
}

export function isDirectExecution(argvEntry = process.argv[1]) {
  return Boolean(argvEntry) && import.meta.url === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution()) {
  await main();
}
