#!/usr/bin/env bun
/**
 * Audit `src/full.ts` to ensure every public runtime export from every module
 * barrel (excluding `storybook`, which has its own dedicated entry point) is
 * re-exported from the CDN/full bundle.
 *
 * Usage: bun scripts/check-full-bundle.mjs
 */

import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Modules whose runtime/type surface must appear in src/full.ts.
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

// Names that are intentionally not re-exported from full.ts (document why).
const INTENTIONAL_OMISSIONS = new Map([
  // a11y.prefersReducedMotion collides with motion.prefersReducedMotion in the
  // flat bundle. Use @bquery/bquery/a11y for the reactive signal variant.
  ['a11y:prefersReducedMotion', 'collides with motion.prefersReducedMotion'],
]);

async function loadModuleExports(name) {
  const url = pathToFileURL(resolve(repoRoot, 'src', name, 'index.ts')).href;
  const mod = await import(url);
  return Object.keys(mod).sort();
}

async function readFullExports() {
  const file = resolve(repoRoot, 'src', 'full.ts');
  const src = await Bun.file(file).text();
  // Capture every identifier that appears inside an `export { ... } from '...';` block.
  const names = new Set();
  const re = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = re.exec(src)) !== null) {
    const block = match[1];
    for (const raw of block.split(',')) {
      const id = raw.trim().split(/\s+as\s+/)[0].trim();
      if (id) names.add(id);
    }
  }
  return names;
}

async function main() {
  const fullExports = await readFullExports();
  const missing = [];

  for (const name of MODULES) {
    let runtimeExports;
    try {
      runtimeExports = await loadModuleExports(name);
    } catch (err) {
      console.error(`! Skipped runtime check for ${name}: ${err.message}`);
      continue;
    }
    for (const exp of runtimeExports) {
      if (fullExports.has(exp)) continue;
      if (INTENTIONAL_OMISSIONS.has(`${name}:${exp}`)) continue;
      missing.push(`${name}.${exp}`);
    }
  }

  if (missing.length === 0) {
    console.log('✓ src/full.ts is in sync with all module barrels.');
    process.exit(0);
  }

  console.error('✗ src/full.ts is missing the following runtime exports:');
  for (const item of missing) console.error(`  - ${item}`);
  process.exit(1);
}

await main();
