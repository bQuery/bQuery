import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_DIR, REPO_ROOT } from './helpers';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const root = readJson(join(REPO_ROOT, 'package.json'));
const pkg = readJson(join(PACKAGE_DIR, 'package.json'));

describe('create-bquery bin of @bquery/bquery', () => {
  it('is declared and ships everything the CLI reads at runtime', () => {
    expect(root.bin['create-bquery']).toBe('bin/create-bquery.mjs');
    expect(existsSync(join(REPO_ROOT, root.bin['create-bquery']))).toBe(true);
    // The CLI imports src/, copies templates/ and reads its own package.json
    // for `--version` (and for `"type": "module"`).
    for (const path of ['src', 'templates', 'package.json']) {
      expect(root.files).toContain(`packages/create-bquery/${path}`);
    }
  });

  it('runs the same CLI as the standalone package', () => {
    const result = spawnSync(process.execPath, [root.bin['create-bquery'], '--version'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toStartWith(`${pkg.version} (templates for @bquery/bquery `);
  });
});
