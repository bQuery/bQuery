/**
 * Test helpers: temp directories and a `node_modules` that makes a scaffolded
 * project resolve `@bquery/bquery` to this repository's sources.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const PACKAGE_DIR = resolve(import.meta.dir, '..');
export const REPO_ROOT = resolve(PACKAGE_DIR, '../..');
export const CLI = join(PACKAGE_DIR, 'bin/create-bquery.js');

const tempDirs: string[] = [];

/** A fresh temp directory, removed by `removeTempDirs()`. */
export const makeTempDir = (prefix = 'create-bquery-'): string => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

/** Removes every directory `makeTempDir()` created. */
export const removeTempDirs = (): void => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
};

/**
 * Links a scaffolded project to this checkout instead of the npm registry:
 *
 * - `node_modules/@bquery/bquery` is a small package whose `exports` map every
 *   sub-path to `src/<module>/index.ts`, with `src` a symlink to the repo's
 *   `src/`. Bun runs the TypeScript sources directly and every import of a
 *   module resolves to the same file, so there is one reactive runtime.
 * - `happy-dom`, `typescript` and `vite` are symlinks to the repo's copies;
 *   `@types/bun` points at `bun-types`, which is what that package re-exports,
 *   and `@types/node` at the repo's copy.
 */
export const linkRepoPackages = (projectDir: string, srcDir = join(REPO_ROOT, 'src')): void => {
  const modules = join(projectDir, 'node_modules');
  const bquery = join(modules, '@bquery/bquery');
  mkdirSync(bquery, { recursive: true });
  mkdirSync(join(modules, '@types'), { recursive: true });
  symlinkSync(srcDir, join(bquery, 'src'), 'dir');
  writeFileSync(
    join(bquery, 'package.json'),
    JSON.stringify({
      name: '@bquery/bquery',
      type: 'module',
      exports: {
        '.': './src/index.ts',
        './full': './src/full.ts',
        './*': './src/*/index.ts',
        './package.json': './package.json',
      },
    })
  );
  for (const name of ['happy-dom', 'typescript', 'vite']) {
    symlinkSync(join(REPO_ROOT, 'node_modules', name), join(modules, name), 'dir');
  }
  symlinkSync(join(REPO_ROOT, 'node_modules/bun-types'), join(modules, '@types/bun'), 'dir');
  symlinkSync(join(REPO_ROOT, 'node_modules/@types/node'), join(modules, '@types/node'), 'dir');
};

/** Runs a command and returns its exit code and combined output. */
export const runCommand = (
  cmd: string[],
  cwd: string,
  env: Record<string, string | undefined> = {}
): { exitCode: number; output: string } => {
  const result = Bun.spawnSync({
    cmd,
    cwd,
    env: { ...process.env, NO_COLOR: '1', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  };
};
