#!/usr/bin/env bun
/**
 * Verify every internal link the docs theme renders from TypeScript.
 *
 * VitePress validates links it finds in markdown and fails the build on dead
 * ones, but the landing page's links live in `docs/.vitepress/theme/` — data
 * modules and Vue components — where the build never looks. Renaming a page
 * would therefore ship a silent 404 on the site's most visited page.
 *
 * This closes that gap: every `/path` string in the theme has to resolve to a
 * real markdown file (`docs/<path>.md` or `docs/<path>/index.md`).
 *
 * Usage: bun scripts/check-theme-links.mjs
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');
const docsRoot = join(repoRoot, 'docs');
const themeRoot = join(docsRoot, '.vitepress', 'theme');

/** Source files that may contain internal links. */
const SOURCE_EXTENSIONS = ['.ts', '.vue'];

/**
 * Site-absolute paths in quoted strings: `link: '/guide/router'`,
 * `href('/release-notes/')`. Anchors, protocols and asset paths are skipped.
 */
const LINK_PATTERN = /['"`](\/[a-z0-9][a-z0-9\-/.]*)['"`]/gi;
const IGNORED_PREFIXES = ['/assets/', '/public/'];

async function collectSources(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectSources(full)));
    } else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      found.push(full);
    }
  }
  return found;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** A link resolves if `docs/<path>.md` or `docs/<path>/index.md` exists. */
async function resolves(link) {
  const clean = link.replace(/[?#].*$/, '').replace(/\/$/, '');
  if (clean === '') return exists(join(docsRoot, 'index.md'));
  return (
    (await exists(join(docsRoot, `${clean}.md`))) ||
    (await exists(join(docsRoot, clean, 'index.md')))
  );
}

export async function auditThemeLinks() {
  const sources = await collectSources(themeRoot);
  const problems = [];
  let checked = 0;

  for (const file of sources) {
    const contents = await readFile(file, 'utf8');
    const lines = contents.split('\n');

    for (const [index, line] of lines.entries()) {
      for (const match of line.matchAll(LINK_PATTERN)) {
        const link = match[1];
        if (IGNORED_PREFIXES.some((prefix) => link.startsWith(prefix))) continue;
        if (link.includes('.')) continue; // file reference, not a page
        checked += 1;
        if (!(await resolves(link))) {
          problems.push(`${relative(repoRoot, file)}:${index + 1} → ${link}`);
        }
      }
    }
  }

  return { problems, checked, fileCount: sources.length };
}

export async function main() {
  const { problems, checked, fileCount } = await auditThemeLinks();

  if (problems.length === 0) {
    console.log(
      `✓ All ${checked} internal links in docs/.vitepress/theme/ resolve (${fileCount} files scanned).`
    );
    process.exit(0);
  }

  console.error('✗ Dead internal links in the docs theme:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\nEvery link must resolve to docs/<path>.md or docs/<path>/index.md.');
  process.exit(1);
}

export function isDirectExecution(argvEntry = process.argv[1]) {
  return Boolean(argvEntry) && import.meta.url === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution()) {
  await main();
}
