import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BQUERY_RANGE, BQUERY_VERSION, DEV_DEPENDENCY_RANGES } from '../src/versions.js';
import { PACKAGE_DIR, REPO_ROOT } from './helpers';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const root = readJson(join(REPO_ROOT, 'package.json'));

describe('versions written into projects', () => {
  it('track the bQuery version of this repository', () => {
    expect(BQUERY_VERSION).toBe(root.version);
    expect(BQUERY_RANGE).toBe(`^${root.version}`);
  });

  it('use the dev-dependency ranges the repository is tested with', () => {
    for (const [name, range] of Object.entries(DEV_DEPENDENCY_RANGES)) {
      if (root.devDependencies[name] !== undefined) {
        expect({ name, range }).toEqual({ name, range: root.devDependencies[name] });
      }
    }
  });

  it('mirror the package metadata of the root package', () => {
    const pkg = readJson(join(PACKAGE_DIR, 'package.json'));
    expect(pkg.name).toBe('create-bquery');
    expect(pkg.license).toBe(root.license);
    expect(pkg.engines).toEqual(root.engines);
    expect(pkg.repository).toEqual({ ...root.repository, directory: 'packages/create-bquery' });
    expect(pkg.dependencies).toBeUndefined();
  });
});
