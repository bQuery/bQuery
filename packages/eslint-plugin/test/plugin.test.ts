import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import plugin from '../src/index.js';
import pkg from '../package.json';

const guidePath = resolve(import.meta.dir, '../../../docs/guide/eslint-plugin.md');

/** VitePress heading slug for simple ASCII headings. */
const slug = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

describe('@bquery/eslint-plugin', () => {
  it('exposes meta from package.json', () => {
    expect(plugin.meta).toEqual({ name: pkg.name, version: pkg.version });
  });

  it('documents every rule', async () => {
    const guide = await readFile(guidePath, 'utf8');
    const headings = new Set(
      [...guide.matchAll(/^## (.+)$/gm)].map((match) => slug(match[1] ?? ''))
    );
    for (const [name, rule] of Object.entries(plugin.rules)) {
      const docs = rule.meta?.docs;
      expect(docs?.description).toBeTruthy();
      expect(docs?.url).toBe(`https://bquery.js.org/guide/eslint-plugin#${name}`);
      expect(rule.meta?.schema).toEqual([]);
      expect(Object.keys(rule.meta?.messages ?? {}).length).toBeGreaterThan(0);
      expect(headings.has(name)).toBe(true);
    }
  });

  it('enables every rule in the recommended flat config', () => {
    const { recommended } = plugin.configs;
    expect(recommended.plugins['@bquery']).toBe(plugin);
    expect(Object.keys(recommended.rules).sort()).toEqual(
      Object.keys(plugin.rules)
        .map((name) => `@bquery/${name}`)
        .sort()
    );
  });

  it('lints a file end to end with the recommended config', async () => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        plugin.configs.recommended,
        { languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
      ],
    });
    const [result] = await eslint.lintText(
      [
        `import { $, untrack, signal } from '@bquery/bquery';`,
        `import { trusted } from '@bquery/bquery/security';`,
        `const count = signal(0);`,
        `$('#app');`,
        `untrack(() => count.value);`,
        `export const html = (input) => trusted(input);`,
      ].join('\n')
    );
    const found = result?.messages.map((message) => [message.ruleId, message.severity]);
    expect(found).toEqual([
      ['@bquery/prefer-subpath-imports', 1],
      ['@bquery/no-top-level-dollar', 1],
      ['@bquery/no-value-in-untracked', 1],
      ['@bquery/no-dynamic-trusted-html', 2],
    ]);
  });
});
