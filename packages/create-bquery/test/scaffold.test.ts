import { afterAll, describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BQUERY_RANGE,
  BQUERY_VERSION,
  ScaffoldError,
  detectPackageManager,
  isEmptyDir,
  projectCommands,
  scaffold,
  toValidProjectName,
  validateProjectName,
  type Runtime,
  type Template,
} from '../src/index.js';
import { makeTempDir, removeTempDirs } from './helpers';

afterAll(removeTempDirs);

/** The exact file set of every template variant. */
const EXPECTED_FILES: Record<string, string[]> = {
  cdn: [
    '.gitignore',
    'README.md',
    'app.js',
    'bunfig.toml',
    'index.html',
    'package.json',
    'serve.js',
    'styles.css',
    'test/app.test.js',
    'test/setup.js',
  ],
  spa: [
    '.gitignore',
    'README.md',
    'bunfig.toml',
    'index.html',
    'package.json',
    'src/app.ts',
    'src/main.ts',
    'src/pages/about.ts',
    'src/pages/home.ts',
    'src/pages/not-found.ts',
    'src/stores/todos.ts',
    'src/style.css',
    'test/app.test.ts',
    'test/setup.ts',
    'test/todos.test.ts',
    'tsconfig.json',
  ],
  'ssr-node': [
    '.gitignore',
    'README.md',
    'package.json',
    'src/app.ts',
    'src/server.ts',
    'test/app.test.ts',
    'tsconfig.json',
  ],
  'ssr-bun': [
    '.gitignore',
    'README.md',
    'package.json',
    'src/app.ts',
    'src/server.ts',
    'test/app.test.ts',
    'tsconfig.json',
  ],
  'ssr-deno': [
    '.gitignore',
    'README.md',
    'deno.json',
    'src/app.ts',
    'src/server.ts',
    'test/app.test.ts',
  ],
  fullstack: [
    '.gitignore',
    'README.md',
    'bunfig.toml',
    'client.ts',
    'client/notes.ts',
    'package.json',
    'server.ts',
    'server/app.ts',
    'server/notes-repo.ts',
    'shared/note.ts',
    'shared/pages.ts',
    'styles.css',
    'test/client.test.ts',
    'test/server.test.ts',
    'test/setup.ts',
    'tsconfig.json',
  ],
};

const VARIANTS: Array<{ key: string; template: Template; runtime?: Runtime }> = [
  { key: 'cdn', template: 'cdn' },
  { key: 'spa', template: 'spa' },
  { key: 'ssr-node', template: 'ssr', runtime: 'node' },
  { key: 'ssr-bun', template: 'ssr', runtime: 'bun' },
  { key: 'ssr-deno', template: 'ssr', runtime: 'deno' },
  { key: 'fullstack', template: 'fullstack' },
];

const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8');

describe('scaffold()', () => {
  for (const { key, template, runtime } of VARIANTS) {
    describe(key, () => {
      const dir = join(makeTempDir(), 'my-app');
      const result = scaffold({ targetDir: dir, template, runtime });

      it('writes exactly the template files', async () => {
        const { files, targetDir, projectName } = await result;
        expect(files).toEqual(EXPECTED_FILES[key]);
        expect(targetDir).toBe(dir);
        expect(projectName).toBe('my-app');
        for (const file of files) expect(existsSync(join(dir, file))).toBe(true);
      });

      it('restores .gitignore and leaves no template markers behind', async () => {
        const { files } = await result;
        expect(read(dir, '.gitignore')).toContain('node_modules/');
        for (const file of files) {
          expect(file).not.toMatch(/(^|\/)_|\.tpl\./);
          expect(read(dir, file)).not.toMatch(/\{\{\w+\}\}/);
        }
      });

      it('names the project and depends on the current bQuery release', async () => {
        await result;
        expect(read(dir, 'README.md')).toStartWith('# my-app\n');
        if (key === 'ssr-deno') {
          const deno = JSON.parse(read(dir, 'deno.json'));
          expect(deno.imports['@bquery/bquery/']).toBe(`npm:/@bquery/bquery@${BQUERY_RANGE}/`);
          expect(Object.keys(deno.tasks)).toEqual(['dev', 'start', 'test', 'check']);
          return;
        }
        const pkg = JSON.parse(read(dir, 'package.json'));
        expect(pkg.name).toBe('my-app');
        expect(pkg.private).toBe(true);
        expect(pkg.type).toBe('module');
        expect(pkg.scripts.test).toBeString();
        const bquery =
          pkg.dependencies?.['@bquery/bquery'] ?? pkg.devDependencies['@bquery/bquery'];
        expect(bquery).toBe(key === 'cdn' ? BQUERY_VERSION : BQUERY_RANGE);
      });
    });
  }

  it('pins the CDN URL to the same release as the test dependency', async () => {
    const dir = join(makeTempDir(), 'cdn-page');
    await scaffold({ targetDir: dir, template: 'cdn' });
    const html = read(dir, 'index.html');
    expect(html).toContain(`https://unpkg.com/@bquery/bquery@${BQUERY_VERSION}/dist/full.es.mjs`);
    expect(html).toContain('<title>cdn-page</title>');
  });

  it('gives each SSR runtime its own server entry and scripts', async () => {
    const entries: Record<string, string> = {};
    for (const runtime of ['node', 'bun', 'deno'] as const) {
      const dir = join(makeTempDir(), 'app');
      await scaffold({ targetDir: dir, template: 'ssr', runtime });
      entries[runtime] = read(dir, 'src/server.ts');
      if (runtime !== 'deno') {
        const { scripts } = JSON.parse(read(dir, 'package.json'));
        expect(scripts.start).toStartWith(runtime === 'node' ? 'node ' : 'bun ');
      }
    }
    expect(entries.node).toContain('createNodeHandler');
    expect(entries.bun).toContain('Bun.serve(');
    expect(entries.deno).toContain('Deno.serve(');
  });

  it('uses projectName over the directory name', async () => {
    const dir = join(makeTempDir(), 'Some Dir');
    const { projectName } = await scaffold({
      targetDir: dir,
      template: 'spa',
      projectName: '@acme/web',
    });
    expect(projectName).toBe('@acme/web');
    expect(JSON.parse(read(dir, 'package.json')).name).toBe('@acme/web');
  });

  it('refuses a non-empty directory', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'notes.txt'), 'keep me');
    const attempt = scaffold({ targetDir: dir, template: 'spa', projectName: 'app' });
    await expect(attempt).rejects.toBeInstanceOf(ScaffoldError);
    await expect(attempt).rejects.toMatchObject({ code: 'DIR_NOT_EMPTY' });
    expect(existsSync(join(dir, 'package.json'))).toBe(false);
  });

  it('writes into a non-empty directory with force, keeping unrelated files', async () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, 'notes.txt'), 'keep me');
    writeFileSync(join(dir, 'README.md'), 'old readme');
    await scaffold({ targetDir: dir, template: 'cdn', projectName: 'app', force: true });
    expect(read(dir, 'notes.txt')).toBe('keep me');
    expect(read(dir, 'README.md')).toStartWith('# app\n');
  });

  it('treats a directory with only .git as empty', async () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, '.git'));
    expect(isEmptyDir(dir)).toBe(true);
    await scaffold({ targetDir: dir, template: 'cdn', projectName: 'app' });
    expect(existsSync(join(dir, 'index.html'))).toBe(true);
  });

  it('refuses a target that is a file', async () => {
    const file = join(makeTempDir(), 'file');
    writeFileSync(file, '');
    await expect(scaffold({ targetDir: file, projectName: 'app' })).rejects.toMatchObject({
      code: 'NOT_A_DIRECTORY',
    });
  });

  it('rejects invalid names, templates and runtimes', async () => {
    const base = makeTempDir();
    await expect(scaffold({ targetDir: join(base, 'My App') })).rejects.toMatchObject({
      code: 'INVALID_NAME',
    });
    await expect(scaffold({ targetDir: join(base, 'a'), projectName: 'fs' })).rejects.toThrow(
      /core module/
    );
    await expect(
      scaffold({ targetDir: join(base, 'b'), template: 'vue' as Template })
    ).rejects.toMatchObject({ code: 'INVALID_TEMPLATE' });
    await expect(
      scaffold({ targetDir: join(base, 'c'), template: 'ssr', runtime: 'workerd' as Runtime })
    ).rejects.toMatchObject({ code: 'INVALID_RUNTIME' });
    await expect(scaffold({ targetDir: '' })).rejects.toMatchObject({ code: 'MISSING_TARGET' });
    expect(existsSync(join(base, 'My App'))).toBe(false);
  });
});

describe('validateProjectName()', () => {
  it('accepts npm package names', () => {
    for (const name of ['app', 'my-app', 'my.app_2', '@scope/app']) {
      expect({ name, ...validateProjectName(name) }).toEqual({ name, valid: true, problems: [] });
    }
  });

  it('explains what is wrong with invalid names', () => {
    const cases: Record<string, RegExp> = {
      '': /non-empty/,
      MyApp: /lowercase/,
      '.app': /period/,
      _app: /underscore/,
      ' app': /spaces/,
      'my app': /URL-friendly/,
      'app!': /special characters/,
      'a~b': /special characters/,
      node_modules: /not a valid package name/,
      http: /core module/,
      [`a${'b'.repeat(214)}`]: /214/,
    };
    for (const [name, problem] of Object.entries(cases)) {
      const result = validateProjectName(name);
      expect(result.valid).toBe(false);
      expect(result.problems.join('; ')).toMatch(problem);
    }
  });

  it('suggests a valid name', () => {
    expect(toValidProjectName('My Cool App!')).toBe('my-cool-app');
    expect(toValidProjectName('__Private')).toBe('private');
    expect(toValidProjectName('???')).toBe('bquery-app');
    expect(toValidProjectName('http')).toBe('bquery-app');
  });
});

describe('detectPackageManager()', () => {
  it('reads npm_config_user_agent', () => {
    expect(detectPackageManager('pnpm/9.12.0 npm/? node/v24.0.0 linux x64')).toBe('pnpm');
    expect(detectPackageManager('yarn/1.22.22 npm/? node/v24.0.0 darwin arm64')).toBe('yarn');
    expect(detectPackageManager('bun/1.4.2 npm/? node/v24.3.0 linux x64')).toBe('bun');
    expect(detectPackageManager('npm/11.0.0 node/v24.0.0 linux x64')).toBe('npm');
    expect(detectPackageManager('cnpm/9.0.0')).toBe('npm');
    expect(detectPackageManager('')).toBe('npm');
  });
});

describe('projectCommands()', () => {
  it('writes commands for the package manager', () => {
    expect(projectCommands({ template: 'spa', packageManager: 'npm' })).toEqual({
      install: 'npm install',
      dev: 'npm run dev',
      test: 'npm test',
    });
    expect(projectCommands({ template: 'cdn', packageManager: 'bun' })).toEqual({
      install: 'bun install',
      dev: 'bun run start',
      test: 'bun run test',
    });
    expect(projectCommands({ template: 'fullstack', packageManager: 'pnpm' }).dev).toBe('pnpm dev');
  });

  it('uses deno tasks for the Deno runtime', () => {
    expect(projectCommands({ template: 'ssr', runtime: 'deno', packageManager: 'yarn' })).toEqual({
      install: 'deno install',
      dev: 'deno task dev',
      test: 'deno task test',
    });
  });
});
