import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';

import {
  EXPORT_MAP_PATH,
  buildExportMap,
  formatExportMap,
  readSubpaths,
} from '../scripts/generate-export-map.mjs';

describe('export-map.json', () => {
  it('matches the source barrels (run `bun packages/eslint-plugin/scripts/generate-export-map.mjs`)', async () => {
    const { map, unmapped } = await buildExportMap();
    const committed = await readFile(EXPORT_MAP_PATH, 'utf8');
    expect(committed).toBe(await formatExportMap(map));
    expect(unmapped).toEqual([]);
  }, 60_000);

  it('maps only to module subpaths listed in package.json exports', async () => {
    const subpaths = new Set(await readSubpaths());
    const { exports } = JSON.parse(await readFile(EXPORT_MAP_PATH, 'utf8')) as {
      exports: Record<string, string>;
    };
    for (const subpath of Object.values(exports)) expect(subpaths.has(subpath)).toBe(true);
    expect(exports).toMatchObject({
      $: 'core',
      signal: 'reactive',
      useEffect: 'component',
      sanitize: 'security',
      trusted: 'security',
      prefersReducedMotion: 'motion',
    });
  });
});
