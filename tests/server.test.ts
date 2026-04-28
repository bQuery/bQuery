import { afterEach, describe, expect, it } from 'bun:test';
import { createServer } from '../src/server/index';
import { createStore, destroyStore, listStores } from '../src/store/index';

const SSR_TEST_STORE_ID = 'server-ssr-test';

afterEach(() => {
  if (listStores().some((store) => store.$id === SSR_TEST_STORE_ID)) {
    destroyStore(SSR_TEST_STORE_ID);
  }
});

describe('server/createServer', () => {
  it('handles static routes via method helpers', async () => {
    const app = createServer();
    app.get('/health', (ctx) => ctx.text('ok'));

    const response = await app.handle('/health');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe('ok');
  });

  it('parses params and repeated query values', async () => {
    const app = createServer();
    app.get('/users/:id', (ctx) =>
      ctx.json({
        filter: ctx.query.filter,
        id: ctx.params.id,
        tags: ctx.query.tag,
      })
    );

    const response = await app.handle('/users/42?filter=active&tag=admin&tag=beta');

    expect(await response.json()).toEqual({
      filter: 'active',
      id: '42',
      tags: ['admin', 'beta'],
    });
  });

  it('runs global and route middleware in order', async () => {
    const app = createServer();

    app.use(async (ctx, next) => {
      ctx.state.steps = ['global'];
      return await next();
    });

    app.get(
      '/pipeline',
      (ctx) => {
        const steps = ctx.state.steps as string[];
        steps.push('handler');
        return ctx.json({ steps });
      },
      [
        async (ctx, next) => {
          const steps = ctx.state.steps as string[];
          steps.push('route');
          return await next();
        },
      ]
    );

    const response = await app.handle('/pipeline');

    expect(await response.json()).toEqual({
      steps: ['global', 'route', 'handler'],
    });
  });

  it('sanitizes html helper output by default', async () => {
    const app = createServer();
    app.get('/unsafe', (ctx) =>
      ctx.html('<div onclick="alert(1)"><script>alert(1)</script><strong>safe</strong></div>')
    );

    const response = await app.handle('/unsafe');
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('<strong>safe</strong>');
    expect(body).not.toContain('<script');
    expect(body).not.toContain('onclick=');
  });

  it('renders SSR templates through the server context helper', async () => {
    createStore({
      id: SSR_TEST_STORE_ID,
      state: () => ({
        ready: true,
      }),
    });

    const app = createServer();
    app.get('/ssr', (ctx) =>
      ctx.render('<main><h1 bq-text="title"></h1></main>', { title: 'Server Rendered' }, {
        includeStoreState: [SSR_TEST_STORE_ID],
      })
    );

    const response = await app.handle('/ssr');
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('Server Rendered');
    expect(body).toContain('__BQUERY_INITIAL_STATE__');
    expect(body).toContain(SSR_TEST_STORE_ID);
  });

  it('returns 404 for unmatched routes', async () => {
    const app = createServer();

    const response = await app.handle('/missing');

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not Found');
  });

  it('uses the custom error handler when middleware or handlers throw', async () => {
    const app = createServer({
      onError(error, ctx) {
        const message = error instanceof Error ? error.message : 'unknown';
        return ctx.json({ message }, { status: 418 });
      },
    });

    app.get('/boom', () => {
      throw new Error('boom');
    });

    const response = await app.handle('/boom');

    expect(response.status).toBe(418);
    expect(await response.json()).toEqual({ message: 'boom' });
  });

  it('escapes unsafe characters in json responses', async () => {
    const app = createServer();
    app.get('/json', (ctx) => ctx.json({ html: '<script>alert(1)</script>' }));

    const response = await app.handle('/json');
    const body = await response.text();

    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toContain('\\u003Cscript\\u003Ealert(1)\\u003C/script\\u003E');
    expect(body).not.toContain('<script>');
  });
});
