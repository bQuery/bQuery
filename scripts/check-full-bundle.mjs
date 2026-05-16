#!/usr/bin/env bun
/**
 * Audit `src/full.ts` to ensure every public runtime and type export from every
 * module barrel (excluding `storybook`, which has its own dedicated entry point)
 * is re-exported from the CDN/full bundle.
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

// Runtime names that are intentionally not re-exported from full.ts (document why).
const INTENTIONAL_RUNTIME_OMISSIONS = new Map([
  // a11y.prefersReducedMotion collides with motion.prefersReducedMotion in the
  // flat bundle. Use @bquery/bquery/a11y for the reactive signal variant.
  ['a11y:prefersReducedMotion', 'collides with motion.prefersReducedMotion'],
]);

const INTENTIONAL_TYPE_OMISSIONS = new Map();

function parseExportedIdentifier(rawSpecifier) {
  const specifier = rawSpecifier
    .trim()
    .replace(/^type\s+/, '')
    .replace(/\s+/g, ' ');
  if (!specifier) return undefined;

  const aliasMatch = specifier.match(/\s+as\s+([A-Za-z_$][\w$]*)$/);
  if (aliasMatch) return aliasMatch[1];

  const identifier = specifier.match(/^[A-Za-z_$][\w$]*/);
  return identifier?.[0];
}

/**
 * Normalize an export source specifier to the public module that owns it.
 *
 * - `./module/index` comes from `src/full.ts` and maps to that public module.
 * - `../module/index` comes from a barrel that re-exports another public module.
 * - Any other relative path stays scoped to the current module barrel.
 */
function normalizeExportSourceModule(sourcePath, moduleName) {
  const fullEntryMatch = sourcePath.match(/^\.\/([^/]+)\/index$/);
  if (fullEntryMatch) return fullEntryMatch[1];

  const crossModuleMatch = sourcePath.match(/^\.\.\/([^/]+)\/index$/);
  if (crossModuleMatch) return crossModuleMatch[1];

  if (moduleName) return moduleName;
  throw new Error(
    `Unable to normalize export source module from "${sourcePath}". ` +
      `Expected "./module/index", "../module/index", or a path scoped to the current module barrel.`
  );
}

function normalizeExportSourceModules(sourcePaths, moduleName) {
  const normalized = new Set();

  for (const sourcePath of sourcePaths ?? []) {
    normalized.add(normalizeExportSourceModule(sourcePath, moduleName));
  }

  return normalized;
}

export function collectNamedExports(source) {
  const runtime = new Set();
  const types = new Set();
  const runtimeSources = new Map();
  const typeSources = new Map();
  const wildcardExport = /export\s+(?:type\s+)?\*\s+from\s+['"][^'"]+['"]/;

  if (wildcardExport.test(source)) {
    throw new Error('Wildcard re-exports are not supported by check-full-bundle.mjs');
  }

  const re = /export\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = re.exec(source)) !== null) {
    const declarationIsTypeOnly = Boolean(match[1]);
    const block = match[2].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const sourcePath = match[3];

    for (const raw of block.split(',')) {
      const trimmed = raw.trim();
      const specifierIsTypeOnly = declarationIsTypeOnly || trimmed.startsWith('type ');
      const id = parseExportedIdentifier(trimmed);
      if (!id) continue;

      if (specifierIsTypeOnly) {
        types.add(id);
        let fromSources = typeSources.get(id);
        if (!fromSources) {
          fromSources = new Set();
          typeSources.set(id, fromSources);
        }
        fromSources.add(sourcePath);
      } else {
        runtime.add(id);
        let fromSources = runtimeSources.get(id);
        if (!fromSources) {
          fromSources = new Set();
          runtimeSources.set(id, fromSources);
        }
        fromSources.add(sourcePath);
      }
    }
  }

  return { runtime, types, runtimeSources, typeSources };
}

async function readNamedExports(file) {
  const src = await Bun.file(file).text();
  return collectNamedExports(src);
}

async function loadModuleExports(name) {
  return readNamedExports(resolve(repoRoot, 'src', name, 'index.ts'));
}

async function readFullExports() {
  return readNamedExports(resolve(repoRoot, 'src', 'full.ts'));
}

export async function auditFullBundle({
  modules = MODULES,
  loadModule = loadModuleExports,
  readFull = readFullExports,
} = {}) {
  const fullExports = await readFull();
  const missingRuntime = [];
  const missingTypes = [];
  const skippedModules = [];

  for (const name of modules) {
    let moduleExports;
    try {
      moduleExports = await loadModule(name);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      skippedModules.push(`${name}: ${reason}`);
      continue;
    }

    for (const exp of [...moduleExports.runtime].sort()) {
      const moduleOrigins = normalizeExportSourceModules(moduleExports.runtimeSources.get(exp), name);
      const fullOrigins = normalizeExportSourceModules(fullExports.runtimeSources.get(exp), 'full');
      if ([...moduleOrigins].some(origin => fullOrigins.has(origin))) continue;
      if (INTENTIONAL_RUNTIME_OMISSIONS.has(`${name}:${exp}`)) continue;
      missingRuntime.push(`${name}.${exp}`);
    }

    for (const exp of [...moduleExports.types].sort()) {
      const moduleOrigins = normalizeExportSourceModules(moduleExports.typeSources.get(exp), name);
      const fullOrigins = normalizeExportSourceModules(fullExports.typeSources.get(exp), 'full');
      if ([...moduleOrigins].some(origin => fullOrigins.has(origin))) continue;
      if (INTENTIONAL_TYPE_OMISSIONS.has(`${name}:${exp}`)) continue;
      missingTypes.push(`${name}.${exp}`);
    }
  }

  return { missingRuntime, missingTypes, skippedModules };
}

export async function main({
  modules = MODULES,
  loadModule = loadModuleExports,
  readFull = readFullExports,
  log = console.log,
  error = console.error,
  exit,
} = {}) {
  const terminate = exit ?? process.exit.bind(process);
  const { missingRuntime, missingTypes, skippedModules } = await auditFullBundle({
    modules,
    loadModule,
    readFull,
  });

  if (skippedModules.length === 0 && missingRuntime.length === 0 && missingTypes.length === 0) {
    log('✓ src/full.ts runtime and type exports are in sync with all module barrels.');
    terminate(0);
    return 0;
  }

  if (skippedModules.length > 0) {
    error('✗ check-full-bundle could not validate the following module barrels:');
    for (const item of skippedModules) error(`  - ${item}`);
  }

  if (missingRuntime.length > 0) {
    error('✗ src/full.ts is missing the following runtime exports:');
    for (const item of missingRuntime) error(`  - ${item}`);
  }

  if (missingTypes.length > 0) {
    error('✗ src/full.ts is missing the following type exports:');
    for (const item of missingTypes) error(`  - ${item}`);
  }

  terminate(1);
  return 1;
}

export function isDirectExecution(argvEntry = process.argv[1]) {
  return Boolean(argvEntry) && import.meta.url === pathToFileURL(resolve(argvEntry)).href;
}

if (isDirectExecution()) {
  await main();
}
