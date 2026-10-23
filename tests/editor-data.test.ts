/**
 * Editor IntelliSense data (#227): the `bq-*` custom data and the config JSON
 * Schema are generated from the sources, so these tests fail when a directive
 * or config option is added without regenerating them.
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getBqueryConfig } from '../src/platform/config';
import { BUILT_IN_DIRECTIVES } from '../src/view/directive-registry';
import { TRANSITION_ATTRS, TRANSITION_PRESET_NAMES } from '../src/view/directives/transitions';
interface GenerateEditorDataModule {
  COMMON_BIND_ATTRIBUTES: string[];
  COMMON_EVENTS: string[];
  generateEditorData: () => Promise<Array<[path: string, content: string]>>;
}

const { COMMON_BIND_ATTRIBUTES, COMMON_EVENTS, generateEditorData } = (await import(
  new URL('../scripts/generate-editor-data.mjs', import.meta.url).href
)) as GenerateEditorDataModule;

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const registryNames = new Set(BUILT_IN_DIRECTIVES.map((info) => info.name));

describe('directive registry (#227)', () => {
  it('lists every directive process.ts dispatches', () => {
    const source = read('src/view/process.ts');
    const dispatched = new Set(
      [...source.matchAll(/directive === '([a-z-]+)'/g)].map((match) => match[1])
    );
    // Handled before the dispatch loop, by attribute name.
    for (const marker of ['cloak', 'pre']) {
      expect(source).toContain(`${marker}: \`\${prefix}-${marker}\``);
      dispatched.add(marker);
    }
    // Companion attributes skipped by the dispatcher.
    for (const companion of ['key', ...TRANSITION_ATTRS]) dispatched.add(companion);

    expect([...registryNames].sort()).toEqual([...dispatched].sort());
  });

  it('marks companion attributes and argument directives', () => {
    const companions = BUILT_IN_DIRECTIVES.filter((info) => info.companion).map(
      (info) => info.name
    );
    expect(companions.sort()).toEqual(['key', ...TRANSITION_ATTRS].sort());
    expect(BUILT_IN_DIRECTIVES.find((info) => info.name === 'on')?.argument).toBe('event');
    expect(BUILT_IN_DIRECTIVES.find((info) => info.name === 'bind')?.argument).toBe('attribute');
  });

  it('offers the real transition preset names', () => {
    const transition = BUILT_IN_DIRECTIVES.find((info) => info.name === 'transition');
    expect(transition?.values).toEqual(TRANSITION_PRESET_NAMES);
    expect(TRANSITION_PRESET_NAMES).toEqual(expect.arrayContaining(['fade', 'slide', 'scale']));
  });

  it('links every directive to a heading that exists in the view guide', () => {
    // VitePress heading slugs: lowercase, punctuation dropped, runs of
    // separators collapsed to a single dash.
    const slugs = new Set(
      [...read('docs/guide/view.md').matchAll(/^#{2,4} (.+)$/gm)].map((match) =>
        match[1]
          .toLowerCase()
          .replace(/[`"']/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      )
    );
    const missing = BUILT_IN_DIRECTIVES.filter((info) => !slugs.has(info.docs)).map(
      (info) => `${info.name} → #${info.docs}`
    );
    expect(missing).toEqual([]);
  });
});

describe('generated editor files (#227)', () => {
  it('are up to date with the sources', async () => {
    const files = await generateEditorData();
    for (const [path, content] of files) {
      expect(readFileSync(path, 'utf8')).toBe(content);
    }
  });

  it('describes every directive in the VS Code custom data', () => {
    const data = JSON.parse(read('editor/html-custom-data.json')) as {
      version: number;
      globalAttributes: Array<{ name: string; values?: Array<{ name: string }> }>;
    };
    const names = data.globalAttributes.map((attribute) => attribute.name);
    expect(data.version).toBe(1.1);

    for (const info of BUILT_IN_DIRECTIVES) {
      if (info.argument) continue;
      expect(names).toContain(`bq-${info.name}`);
    }
    for (const event of COMMON_EVENTS) expect(names).toContain(`bq-on:${event}`);
    for (const attribute of COMMON_BIND_ATTRIBUTES) expect(names).toContain(`bq-bind:${attribute}`);
    expect(new Set(names).size).toBe(names.length);

    const animate = data.globalAttributes.find((attribute) => attribute.name === 'bq-animate');
    expect(animate?.values).toEqual([{ name: 'flip' }]);
  });

  it('schema covers every top-level config section and its JSON-representable options', () => {
    const schema = JSON.parse(read('editor/bquery-config.schema.json')) as {
      properties: Record<string, { $ref?: string }>;
      $defs: Record<string, { properties: Record<string, unknown> }>;
    };
    const defaults = getBqueryConfig() as Record<string, Record<string, unknown>>;

    for (const [section, values] of Object.entries(defaults)) {
      const ref = schema.properties[section]?.$ref;
      expect(ref, section).toBeDefined();
      const definition = schema.$defs[ref!.replace('#/$defs/', '')];
      for (const [option, value] of Object.entries(values)) {
        // Other suites may have configured function-valued options globally.
        if (typeof value === 'function') continue;
        expect(definition.properties, `${section}.${option}`).toHaveProperty(option);
      }
    }
    // Function-valued options cannot be expressed in JSON.
    expect(schema.$defs.BqueryPageMetaConfig.properties).not.toHaveProperty('titleTemplate');
  });

  it('turns literal unions into enums', () => {
    const schema = JSON.parse(read('editor/bquery-config.schema.json')) as {
      $defs: Record<string, { properties: Record<string, { enum?: unknown[] }> }>;
    };
    expect(schema.$defs.BqueryFetchConfig.properties.parseAs.enum).toEqual([
      'json',
      'text',
      'blob',
      'arrayBuffer',
      'formData',
      'response',
    ]);
    expect(schema.$defs.BqueryCookieConfig.properties.sameSite.enum).toEqual([
      'Strict',
      'Lax',
      'None',
    ]);
  });

  it('ships both files in the package', () => {
    const pkg = JSON.parse(read('package.json')) as {
      files: string[];
      exports: Record<string, unknown>;
    };
    expect(pkg.files).toContain('editor');
    expect(pkg.exports['./editor/html-custom-data.json']).toBe('./editor/html-custom-data.json');
    expect(pkg.exports['./editor/bquery-config.schema.json']).toBe(
      './editor/bquery-config.schema.json'
    );
  });
});
