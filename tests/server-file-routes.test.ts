/**
 * Server bridge for the file-route convention (#149) — actions reachable as
 * server routes, optional JSON loader endpoints, and graceful 405/404 handling.
 */

import { describe, expect, it } from 'bun:test';
import { createFileRoutes, type Action, type Load } from '../src/router/index';
import {
  createFileRouteServerRoutes,
  createServer,
  mountFileRoutes,
} from '../src/server/index';

const formBody = (fields: Record<string, string>): URLSearchParams => new URLSearchParams(fields);

describe('createFileRouteServerRoutes', () => {
  it('registers an action endpoint reachable via POST', async () => {
    const action: Action = async ({ request, params }) => {
      const data = await request.formData();
      return { ok: true, id: params.id, name: data.get('name') };
    };
    const { entries } = createFileRoutes({
      'routes/users/[id]/+page.ts': { default: 'User', action },
    });

    const app = mountFileRoutes(createServer(), entries);
    const res = await app.handle({
      url: '/users/42',
      method: 'POST',
      body: formBody({ name: 'Ada' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: '42', name: 'Ada' });
  });

  it('skips action routes for eager modules without an action', async () => {
    const { entries } = createFileRoutes({ 'routes/static/+page.ts': { default: 'S' } });
    const routes = createFileRouteServerRoutes(entries);
    expect(routes).toHaveLength(0);

    const app = mountFileRoutes(createServer(), entries);
    const res = await app.handle({ url: '/static', method: 'POST' });
    expect(res.status).toBe(404); // no route registered → default not-found
  });

  it('returns 405 when a lazily-imported route exposes no action', async () => {
    const { entries } = createFileRoutes({
      'routes/lazy/+page.ts': () => Promise.resolve({ default: 'L' }),
    });
    const app = mountFileRoutes(createServer(), entries);
    const res = await app.handle({ url: '/lazy', method: 'POST' });
    expect(res.status).toBe(405);
  });

  it('optionally serves loader data as JSON under dataPath', async () => {
    const load: Load = ({ params }) => ({ id: params.id, source: 'loader' });
    const { entries } = createFileRoutes({
      'routes/users/[id]/+page.ts': { default: 'User', load },
    });

    const app = mountFileRoutes(createServer(), entries, { dataPath: '/__data' });
    const res = await app.handle({ url: '/__data/users/7', method: 'GET' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: '7', source: 'loader' });
  });

  it('applies a base path to generated routes', () => {
    const { entries } = createFileRoutes({
      'routes/users/[id]/+page.ts': { default: 'User', action: (() => ({})) as Action },
    });
    const routes = createFileRouteServerRoutes(entries, { basePath: '/app' });
    expect(routes[0].path).toBe('/app/users/:id');
  });

  it('defaults loader middleware to the action middleware chain (#181)', () => {
    const auth: import('../src/server/index').ServerMiddleware = (_ctx, next) => next();
    const { entries } = createFileRoutes({
      'routes/users/[id]/+page.ts': {
        default: 'User',
        action: (() => ({})) as Action,
        load: (() => ({})) as Load,
      },
    });

    const routes = createFileRouteServerRoutes(entries, {
      dataPath: '/__data',
      middlewares: [auth],
    });
    const loaderRoute = routes.find((r) => r.method === 'GET');
    // The loader inherits the action middleware chain when dataMiddlewares is unset.
    expect(loaderRoute?.middlewares).toEqual([auth]);
  });

  it('allows opting the loader out with an explicit empty dataMiddlewares (#181)', () => {
    const auth: import('../src/server/index').ServerMiddleware = (_ctx, next) => next();
    const { entries } = createFileRoutes({
      'routes/users/[id]/+page.ts': {
        default: 'User',
        action: (() => ({})) as Action,
        load: (() => ({})) as Load,
      },
    });

    const routes = createFileRouteServerRoutes(entries, {
      dataPath: '/__data',
      middlewares: [auth],
      dataMiddlewares: [],
    });
    const loaderRoute = routes.find((r) => r.method === 'GET');
    expect(loaderRoute?.middlewares).toEqual([]);
  });
});
