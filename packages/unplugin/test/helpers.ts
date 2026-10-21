import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Repository root (the `@bquery/bquery` sources live in `<repo>/src`). */
export const REPO_ROOT = path.resolve(import.meta.dir, '../../..');

/** A throwaway project directory with small file helpers. */
export interface TempProject {
  root: string;
  write: (rel: string, content: string) => string;
  read: (rel: string) => string;
  path: (rel: string) => string;
  cleanup: () => void;
}

/**
 * Creates a temp project from a `{ relativePath: content }` map. Call
 * `cleanup()` in `afterAll`/`finally`.
 */
export const createProject = (files: Record<string, string> = {}): TempProject => {
  const root = mkdtempSync(path.join(tmpdir(), 'bq-unplugin-'));
  const abs = (rel: string) => path.join(root, rel);
  const write = (rel: string, content: string) => {
    mkdirSync(path.dirname(abs(rel)), { recursive: true });
    writeFileSync(abs(rel), content);
    return abs(rel);
  };
  for (const [rel, content] of Object.entries(files)) write(rel, content);
  return {
    root,
    write,
    read: (rel) => readFileSync(abs(rel), 'utf8'),
    path: abs,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** A typical app: a compiled view, file routes and translatable sources. */
export const SAMPLE_FILES: Record<string, string> = {
  'src/main.js': [
    "import template from './views/home.view.html';",
    "import './views/page.html?bq-view';",
    "import routes, { manifest, layouts } from 'virtual:bquery/routes';",
    "import { messages } from 'virtual:bquery/messages';",
    "import { strings } from './strings.js';",
    'export { template, routes, manifest, layouts, messages, strings };',
  ].join('\n'),
  'src/strings.js': [
    "import { defineMessages } from '@bquery/bquery/i18n';",
    "export const strings = defineMessages({ nav: { home: 'Home', about: 'About' } });",
    "export const title = () => t('page.title');",
  ].join('\n'),
  'src/views/home.view.html':
    '<div><p bq-text="count + 1"></p><p bq-text="`Hi ${name}`"></p></div>',
  'src/views/page.html': '<section bq-show="open"></section>',
  'src/routes/index.ts': "export default 'home';",
  'src/routes/+layout.ts': "export default 'layout';",
  'src/routes/users/[id]/+page.ts':
    "export const load = ({ params }) => ({ id: params.id });\nexport default 'user';",
  'src/routes/api/+server.ts': 'export const GET = () => new Response("server only");',
};

/** Resolves when `predicate` is truthy, polling every 25 ms (rejects after `timeout`). */
export const waitFor = async <T>(
  predicate: () => T | Promise<T>,
  timeout = 5000,
  label = 'condition'
): Promise<T> => {
  const start = Date.now();
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};
