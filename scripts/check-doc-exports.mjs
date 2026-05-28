#!/usr/bin/env bun
/**
 * Audit each `docs/guide/<module>.md` page to ensure every public runtime
 * export from `src/<module>/index.ts` is mentioned at least once.
 *
 * This is intentionally a soft check: it prints a report and exits non-zero
 * only when --strict is passed. The default mode prints the report and exits 0
 * so contributors are informed without being blocked.
 *
 * Usage:
 *   bun scripts/check-doc-exports.mjs            # informational (exit 0)
 *   bun scripts/check-doc-exports.mjs --strict   # exits non-zero on gaps
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectNamedExports } from './check-full-bundle.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');

const MODULES = [
  'core',
  'reactive',
  'concurrency',
  'component',
  'motion',
  'security',
  'platform',
  'router',
  'store',
  'view',
  'storybook',
  'forms',
  'i18n',
  'a11y',
  'dnd',
  'media',
  'plugin',
  'devtools',
  'testing',
  'ssr',
  'server',
];

// Common low-signal names that match too liberally in prose. Skip them so the
// report focuses on identifiers a reader is likely to look up.
const NOISE_NAMES = new Set([
  'type',
  'Type',
  'value',
  'Value',
  'data',
  'Data',
  'options',
  'Options',
  'config',
  'Config',
  'context',
  'Context',
  'state',
  'State',
  'result',
  'Result',
  'props',
  'Props',
  'element',
  'Element',
]);

const strict = process.argv.includes('--strict');

async function readSource(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return undefined;
    throw err;
  }
}

function buildDocCorpus(doc) {
  // Keep fenced code block contents because many public identifiers only appear
  // in examples; strip the fence markers themselves.
  return doc.replace(/^```[^\n]*$/gm, '');
}

function isMentioned(name, corpus) {
  if (NOISE_NAMES.has(name)) return true;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[^\\w$])${escaped}(?:[^\\w$]|$)`);
  return re.test(corpus);
}

// Some modules use guide filenames that differ from the module name.
const DOC_OVERRIDES = new Map([
  ['core', 'api-core.md'],
  ['component', 'components.md'],
]);

async function auditModule(moduleName) {
  const barrelPath = resolve(repoRoot, 'src', moduleName, 'index.ts');
  const docFilename = DOC_OVERRIDES.get(moduleName) ?? `${moduleName}.md`;
  const docPath = resolve(repoRoot, 'docs', 'guide', docFilename);

  const barrel = await readSource(barrelPath);
  if (!barrel) {
    return { moduleName, error: `Missing barrel: src/${moduleName}/index.ts` };
  }

  const doc = await readSource(docPath);
  if (!doc) {
    return { moduleName, error: `Missing guide: docs/guide/${docFilename}` };
  }

  let collected;
  try {
    collected = collectNamedExports(barrel);
  } catch (err) {
    return { moduleName, error: `Could not parse barrel: ${err.message}` };
  }

  const exported = [...collected.runtime].sort();
  if (exported.length === 0) {
    return { moduleName, total: 0, missing: [] };
  }

  const corpus = buildDocCorpus(doc);
  const missing = exported.filter((name) => !isMentioned(name, corpus));

  return { moduleName, total: exported.length, missing };
}

async function main() {
  const results = [];
  for (const moduleName of MODULES) {
    results.push(await auditModule(moduleName));
  }

  let hasGaps = false;
  console.log('Documentation export coverage report');
  console.log('-------------------------------------');
  for (const r of results) {
    if (r.error) {
      console.log(`[error]   ${r.moduleName}: ${r.error}`);
      hasGaps = true;
      continue;
    }
    const covered = r.total - r.missing.length;
    const pct = r.total === 0 ? 100 : Math.round((covered / r.total) * 100);
    const status = r.missing.length === 0 ? 'ok' : 'gap';
    console.log(
      `[${status.padEnd(5)}] ${r.moduleName.padEnd(12)} ${covered}/${r.total} mentioned (${pct}%)`
    );
    if (r.missing.length > 0) {
      hasGaps = true;
      for (const name of r.missing) {
        console.log(`           - ${name}`);
      }
    }
  }

  console.log('-------------------------------------');
  if (!hasGaps) {
    console.log('All public runtime exports are mentioned in their module guide.');
    process.exit(0);
  }

  if (strict) {
    console.log('Strict mode: some exports are not mentioned in their module guide.');
    process.exit(1);
  }

  console.log(
    'Informational: some exports are not mentioned in their module guide. ' +
      'Pass --strict to fail the run.'
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
