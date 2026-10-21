import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { build, createLogger, createServer, type Rollup, type ViteDevServer } from 'vite';
import bqueryVite from '../vite.js';
import { createProject, REPO_ROOT, SAMPLE_FILES, waitFor, type TempProject } from './helpers';

/** Resolve `@bquery/bquery/*` to the repository sources (no build needed). */
const alias = { '@bquery/bquery': path.join(REPO_ROOT, 'src') };

const INDEX_HTML = `<!doctype html>
<html>
  <head><title>app</title><style>p { color: red; }</style></head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`;

const ENTRY_SERVER = `import { createSSRContext, renderToResponse } from '@bquery/bquery/ssr';

export async function render(request, ctx) {
  const ssr = createSSRContext({ request, nonce: ctx.nonce });
  const { pathname } = ssr.url;
  if (pathname === '/fallthrough') return null;
  if (pathname === '/bquery') {
    const template = ctx.template.replace('<div id="app"></div>', '<div id="app"><h1 bq-text="title"></h1></div>');
    return renderToResponse(template, { title: 'Rendered by bQuery' }, { context: ssr });
  }
  if (pathname === '/boom') throw new Error('render exploded');
  if (pathname === '/api-like') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { 'content-type': 'application/json', 'x-from': 'entry' },
    });
  }
  if (pathname === '/response') {
    return new Response(ctx.template.replace('<div id="app"></div>', '<div id="app">resp</div>'), {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  return ctx.template.replace(
    '<div id="app"></div>',
    '<div id="app">SSR ' + pathname + ' nonce=' + ssr.nonce + '</div>'
  );
}
`;

describe('vite build', () => {
  let project: TempProject;
  let output: Rollup.RollupOutput['output'];
  const warnings: string[] = [];

  beforeAll(async () => {
    project = createProject({ ...SAMPLE_FILES, 'index.html': INDEX_HTML });
    const result = (await build({
      root: project.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [bqueryVite({ i18n: true, csp: true })],
      build: {
        write: false,
        rollupOptions: {
          external: [/^@bquery\//],
          onwarn: (warning) => warnings.push(warning.message),
        },
      },
    })) as Rollup.RollupOutput;
    output = result.output;
  });

  afterAll(() => project.cleanup());

  const js = () =>
    output
      .filter((file): file is Rollup.OutputChunk => file.type === 'chunk')
      .map((chunk) => chunk.code)
      .join('\n');

  it('bundles compiled views, the route manifest and the catalogs', () => {
    expect(js()).toContain('count + 1');
    expect(js()).toContain('registerCompiledExpressions');
    expect(js()).toContain('createFileRoutes');
    expect(js()).toContain('/src/routes/users/[id]/+page.ts');
    expect(js()).toContain('Home');
    expect(js()).not.toContain('import.meta.hot');
    expect(JSON.parse(project.read('locales/en.json')).nav.about).toBe('About');
  });

  it('splits lazy route modules into their own chunks', () => {
    const chunks = output.filter((file) => file.type === 'chunk' && !file.isEntry);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
  });

  it('warns about runtime-fallback expressions', () => {
    expect(warnings.some((w) => w.includes('falls back to the runtime evaluator'))).toBe(true);
  });

  it('leaves built HTML without nonces unless csp.build is set', async () => {
    const html = output.find((file) => file.fileName === 'index.html') as Rollup.OutputAsset;
    expect(String(html.source)).not.toContain('nonce=');

    const placeholder = (await build({
      root: project.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [bqueryVite({ i18n: true, csp: { nonce: '__NONCE__', build: true } })],
      build: { write: false, rollupOptions: { external: [/^@bquery\//], onwarn: () => {} } },
    })) as Rollup.RollupOutput;
    const built = placeholder.output.find((file) => file.fileName === 'index.html');
    expect(String((built as Rollup.OutputAsset).source)).toContain('nonce="__NONCE__"');
  });
});

describe('vite dev server', () => {
  let project: TempProject;
  let server: ViteDevServer;
  let base: string;
  const errors: string[] = [];
  const routeUpdates: string[] = [];

  beforeAll(async () => {
    project = createProject({
      ...SAMPLE_FILES,
      'index.html': INDEX_HTML,
      'src/entry-server.js': ENTRY_SERVER,
    });
    const logger = createLogger('error', { allowClearScreen: false });
    logger.error = (msg) => {
      errors.push(msg);
    };
    server = await createServer({
      root: project.root,
      configFile: false,
      customLogger: logger,
      resolve: { alias },
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { port: 0, host: '127.0.0.1', ws: false },
      plugins: [
        bqueryVite({
          i18n: true,
          csp: true,
          ssr: { entry: 'src/entry-server.js' },
          fileRoutes: { onUpdate: (file) => routeUpdates.push(file) },
        }),
      ],
    });
    await server.listen();
    const { port } = server.httpServer!.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await server.close();
    project.cleanup();
  });

  const get = (pathname: string, accept = 'text/html') =>
    fetch(`${base}${pathname}`, { headers: { accept } });

  const nonceOf = (res: Response) =>
    /'nonce-([^']+)'/.exec(res.headers.get('content-security-policy') ?? '')?.[1];

  it('sends a CSP header whose nonce is stamped on every script and style', async () => {
    const res = await get('/about');
    const nonce = nonceOf(res);
    expect(nonce).toMatch(/^[\w-]{22}$/);
    const html = await res.text();
    expect(html).toContain(`<script type="module" src="/@vite/client" nonce="${nonce}">`);
    expect(html).toContain(`<style nonce="${nonce}">`);
    expect(html).toContain(`<meta property="csp-nonce" nonce="${nonce}">`);
    expect(res.headers.get('content-security-policy')).toContain("object-src 'none'");
  });

  it('renders HTML navigations through the SSR entry with the CSP nonce', async () => {
    const res = await get('/about?x=1');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain(`<div id="app">SSR /about nonce=${nonceOf(res)}</div>`);
    expect(html).toContain('/@vite/client');
  });

  it('supports renderToResponse() from @bquery/bquery/ssr', async () => {
    const res = await get('/bquery');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<h1[^>]*>Rendered by bQuery<\/h1>/);
    expect(html).toContain('/@vite/client');
  });

  it('transforms HTML Responses and keeps their status', async () => {
    const res = await get('/response');
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('<div id="app">resp</div>');
    expect(html).toContain('/@vite/client');
  });

  it('passes non-HTML Responses through untouched', async () => {
    const res = await get('/api-like');
    expect(res.status).toBe(201);
    expect(res.headers.get('x-from')).toBe('entry');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('falls through to Vite when render returns null', async () => {
    const res = await get('/fallthrough');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<div id="app"></div>');
  });

  it('reports render errors with a fixed stack trace', async () => {
    const res = await get('/boom');
    expect(res.status).toBe(500);
    await waitFor(() => errors.some((e) => e.includes('render exploded')), 2000, 'error log');
    expect(errors.find((e) => e.includes('render exploded'))).toContain('entry-server.js');
  });

  it('does not render module or asset requests', async () => {
    const res = await get('/src/strings.js', '*/*');
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('serves compiled views with HMR handling', async () => {
    const main = await server.transformRequest('/src/main.js');
    const url = /"(\/src\/views\/home\.view\.html\?[^"]*bq-view[^"]*)"/.exec(main!.code)?.[1];
    expect(url).toBeDefined();
    // Fetch it the way the browser would.
    const res = await get(url!, '*/*');
    expect(res.headers.get('content-type')).toContain('javascript');
    const code = await res.text();
    expect(code).toContain('"count + 1": (__bq_ctx) => (__bq_ctx.count + 1)');
    expect(code).toContain('import.meta.hot.accept');
    expect(code).toContain('export default template');
  });

  it('regenerates virtual:bquery/routes when a route file is added', async () => {
    const before = await server.ssrLoadModule('virtual:bquery/routes');
    expect(before.routes.map((r: { path: string }) => r.path)).toEqual(['/', '/users/:id']);

    project.write('src/routes/about.ts', "export default 'about';");
    await waitFor(() => routeUpdates.some((f) => f.endsWith('about.ts')), 5000, 'route add');
    const after = await server.ssrLoadModule('virtual:bquery/routes');
    expect(after.routes.map((r: { path: string }) => r.path)).toEqual([
      '/about',
      '/',
      '/users/:id',
    ]);
    expect(Object.keys(after.layouts)).toEqual(['/']);
  });

  it('re-extracts messages when a source file changes', async () => {
    const messages = await server.ssrLoadModule('virtual:bquery/messages');
    expect(messages.locales).toEqual(['en']);
    expect(messages.messages.en.nav.home).toBe('Home');

    project.write('src/strings.js', `${SAMPLE_FILES['src/strings.js']}\nt('footer.legal');`);
    await waitFor(
      () => JSON.parse(project.read('locales/en.json')).footer?.legal === '',
      5000,
      'catalog update'
    );
    // The catalog is a watched file of virtual:bquery/messages, so it reloads.
    await waitFor(
      async () =>
        (await server.ssrLoadModule('virtual:bquery/messages')).messages.en.footer?.legal === '',
      5000,
      'messages module update'
    );
  });
});
