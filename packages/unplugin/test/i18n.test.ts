import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rmSync, statSync } from 'node:fs';
import { rollup } from 'rollup';
import { unpluginFactory, type CatalogSyncResult, type I18nOptions } from '../index.js';
import bqueryRollup from '../rollup.js';
import { createProject, type TempProject } from './helpers';

const SOURCES = {
  'src/a.ts': "t('greeting.hello');\nconst m = defineMessages({ cart: { empty: 'Empty cart' } });",
  'src/nested/b.ts': "tc('greeting.bye');",
  'src/ignored.css': "t('not.a.source')",
};

/** Runs a Rollup build of `src/a.ts` with the given i18n options. */
const buildWith = async (project: TempProject, i18n: I18nOptions) => {
  const bundle = await rollup({
    input: project.path('src/a.ts'),
    plugins: [bqueryRollup({ root: project.root, views: false, fileRoutes: false, i18n })],
    onwarn: () => {},
  });
  await bundle.close();
};

/** The i18n sub-plugin plus a minimal Rollup-like hook context. */
const i18nPlugin = (project: TempProject, i18n: I18nOptions) => {
  const plugins = unpluginFactory(
    { root: project.root, i18n },
    { framework: 'rollup', versions: {} }
  );
  const plugin = plugins.find((p) => p.name === 'bquery:i18n')!;
  const warnings: string[] = [];
  const context = { warn: (msg: string) => warnings.push(msg) };
  return {
    warnings,
    buildStart: () => (plugin.buildStart as (this: unknown) => Promise<void>).call(context),
    watchChange: (file: string, event: 'create' | 'update' | 'delete') =>
      (
        plugin.watchChange as (
          this: unknown,
          id: string,
          change: { event: string }
        ) => Promise<void>
      ).call(context, file, { event }),
  };
};

describe('i18n catalogs', () => {
  let project: TempProject;
  beforeEach(() => {
    project = createProject(SOURCES);
  });
  afterEach(() => project.cleanup());

  it('extracts keys from every matching source into the catalog', async () => {
    await buildWith(project, { catalog: 'locales/en.json' });
    expect(JSON.parse(project.read('locales/en.json'))).toEqual({
      cart: { empty: 'Empty cart' },
      greeting: { bye: '', hello: '' },
    });
  });

  it('preserves existing translations and stale keys', async () => {
    project.write(
      'locales/en.json',
      JSON.stringify({ greeting: { hello: 'Hello!' }, old: { key: 'kept' } })
    );
    await buildWith(project, {});
    const catalog = JSON.parse(project.read('locales/en.json'));
    expect(catalog.greeting.hello).toBe('Hello!');
    expect(catalog.old.key).toBe('kept');
  });

  it('does not rewrite catalogs whose content is unchanged', async () => {
    const results: CatalogSyncResult[][] = [];
    const options: I18nOptions = {
      locales: { de: 'locales/de.json' },
      onExtract: (r) => results.push(r),
    };
    await buildWith(project, options);
    const mtimes = ['en', 'de'].map((l) => statSync(project.path(`locales/${l}.json`)).mtimeMs);
    await new Promise((resolve) => setTimeout(resolve, 30));
    await buildWith(project, options);
    expect(results[0].map((r) => [r.locale, r.written])).toEqual([
      ['en', true],
      ['de', true],
    ]);
    expect(results[1].map((r) => [r.locale, r.written])).toEqual([
      ['en', false],
      ['de', false],
    ]);
    expect(['en', 'de'].map((l) => statSync(project.path(`locales/${l}.json`)).mtimeMs)).toEqual(
      mtimes
    );
    // Secondary locales receive empty strings, not the source defaults.
    expect(JSON.parse(project.read('locales/de.json')).cart.empty).toBe('');
  });

  it('updates catalogs on watch changes and prunes deleted sources', async () => {
    const plugin = i18nPlugin(project, { prune: true });
    await plugin.buildStart();
    expect(JSON.parse(project.read('locales/en.json')).greeting).toEqual({ bye: '', hello: '' });

    project.write('src/nested/b.ts', "tc('greeting.bye'); t('menu.open');");
    await plugin.watchChange(project.path('src/nested/b.ts'), 'update');
    expect(JSON.parse(project.read('locales/en.json')).menu).toEqual({ open: '' });

    rmSync(project.path('src/nested/b.ts'));
    await plugin.watchChange(project.path('src/nested/b.ts'), 'delete');
    const catalog = JSON.parse(project.read('locales/en.json'));
    expect(catalog.menu).toBeUndefined();
    expect(catalog.greeting).toEqual({ hello: '' });
  });

  it('ignores changes to files outside `include`', async () => {
    const plugin = i18nPlugin(project, { include: 'src/a.ts' });
    await plugin.buildStart();
    const before = project.read('locales/en.json');
    project.write('src/nested/b.ts', "t('should.not.appear');");
    await plugin.watchChange(project.path('src/nested/b.ts'), 'update');
    expect(project.read('locales/en.json')).toBe(before);
    expect(before).not.toContain('greeting.bye');
  });

  it('warns about and never overwrites an invalid catalog', async () => {
    project.write('locales/en.json', '{ "half": "edited",');
    const plugin = i18nPlugin(project, {});
    await plugin.buildStart();
    expect(plugin.warnings.some((w) => w.includes('not a valid JSON catalog'))).toBe(true);
    expect(project.read('locales/en.json')).toBe('{ "half": "edited",');
  });

  it('only serves catalogs when extraction is disabled', async () => {
    const plugin = i18nPlugin(project, { extract: false });
    await plugin.buildStart();
    expect(() => statSync(project.path('locales/en.json'))).toThrow();
  });
});
