import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import path from 'node:path';
import { build, type BuildResult } from 'esbuild';
import bqueryEsbuild from '../esbuild.js';
import { createProject, SAMPLE_FILES, type TempProject } from './helpers';

describe('esbuild build', () => {
  let project: TempProject;
  let result: BuildResult & { outputFiles: NonNullable<BuildResult['outputFiles']> };
  const consoleWarnings: string[] = [];

  beforeAll(async () => {
    project = createProject(SAMPLE_FILES);
    const spy = spyOn(console, 'warn').mockImplementation((msg: string) => {
      consoleWarnings.push(msg);
    });
    result = await build({
      absWorkingDir: project.root,
      entryPoints: ['src/main.js'],
      bundle: true,
      write: false,
      format: 'esm',
      splitting: true,
      outdir: 'out',
      external: ['@bquery/*'],
      logLevel: 'silent',
      // `root` comes from `absWorkingDir`; `csp`/`ssr` are Vite-only.
      plugins: [bqueryEsbuild({ i18n: true, csp: true, ssr: true })],
    }).finally(() => spy.mockRestore());
  });

  afterAll(() => project.cleanup());

  const main = () => result.outputFiles.find((file) => path.basename(file.path) === 'main.js')!;

  it('compiles view templates', () => {
    expect(main().text).toContain('"count + 1": (__bq_ctx) => __bq_ctx.count + 1');
    expect(main().text).toContain('var template = ');
  });

  it('resolves virtual:bquery/routes with lazy imports split into chunks', () => {
    expect(main().text).toContain('createFileRoutes(manifest, options)');
    expect(main().text).toMatch(/"\/src\/routes\/users\/\[id\]\/\+page\.ts": \(\) => import\(/);
    expect(result.outputFiles.length).toBe(4);
  });

  it('writes the source-locale catalog and serves virtual:bquery/messages', () => {
    expect(JSON.parse(project.read('locales/en.json')).nav.home).toBe('Home');
    expect(main().text).toContain('"home": "Home"');
  });

  it('reports the skipped expression and the ignored Vite-only features once', () => {
    const texts = result.warnings.map((warning) => warning.text);
    expect(texts.some((text) => text.includes('falls back to the runtime evaluator'))).toBe(true);
    // esbuild's buildStart context has no warn(), so this one goes to the console.
    expect(consoleWarnings.filter((text) => text.includes('only supported with Vite'))).toEqual([
      '[bquery] The csp and ssr options are only supported with Vite and ignored for esbuild.',
    ]);
  });
});
