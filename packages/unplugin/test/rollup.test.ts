import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { rollup, type OutputChunk, type RollupOutput } from 'rollup';
import bqueryRollup from '../rollup.js';
import { createProject, SAMPLE_FILES, type TempProject } from './helpers';

describe('rollup build', () => {
  let project: TempProject;
  let output: RollupOutput['output'];
  const warnings: string[] = [];

  beforeAll(async () => {
    project = createProject(SAMPLE_FILES);
    const bundle = await rollup({
      input: project.path('src/main.js'),
      external: [/^@bquery\//],
      plugins: [bqueryRollup({ root: project.root, i18n: { locales: ['locales/de.json'] } })],
      onwarn: (warning) => warnings.push(warning.message),
    });
    ({ output } = await bundle.generate({ format: 'es' }));
    await bundle.close();
  });

  afterAll(() => project.cleanup());

  const entry = () => output.find((file) => file.fileName === 'main.js') as OutputChunk;

  it('compiles *.view.html and ?bq-view imports into registering modules', () => {
    const code = entry().code;
    expect(code).toContain("import { registerCompiledExpressions } from '@bquery/bquery/view'");
    expect(code).toContain('"count + 1": (__bq_ctx) => (__bq_ctx.count + 1)');
    expect(code).toContain('"open": (__bq_ctx) => (__bq_ctx.open)');
    expect(code).toContain('bq-text=\\"count + 1\\"');
  });

  it('warns about expressions that fall back to the runtime evaluator', () => {
    expect(warnings.some((w) => w.includes('src/views/home.view.html') && w.includes('Hi'))).toBe(
      true
    );
  });

  it('generates the file-route manifest with lazy chunks per route', () => {
    const code = entry().code;
    expect(code).toContain("import { createFileRoutes } from '@bquery/bquery/router'");
    expect(code).toContain('"/src/routes/users/[id]/+page.ts": () => import(');
    expect(code).toContain('"/src/routes/+layout.ts": () => import(');
    expect(code).not.toContain('+server');
    const chunks = output.filter((file) => file.type === 'chunk' && !file.isEntry);
    expect(chunks.length).toBe(3);
  });

  it('writes the catalogs and inlines them into virtual:bquery/messages', () => {
    expect(JSON.parse(project.read('locales/en.json'))).toEqual({
      nav: { about: 'About', home: 'Home' },
      page: { title: '' },
    });
    expect(JSON.parse(project.read('locales/de.json'))).toEqual({
      nav: { about: '', home: '' },
      page: { title: '' },
    });
    const code = entry().code;
    expect(code).toContain('"en": {');
    expect(code).toContain('"de": {');
  });
});
