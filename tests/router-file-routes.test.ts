/**
 * File-route convention tests (#149) — path conversion, manifest → routes,
 * client loader binding, and the SSR loader bridge.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { signal } from '../src/reactive/index';
import {
  createFileRoutes,
  createRouteData,
  filePathToRoutePattern,
  getRouteAction,
  getRouteLoad,
  parseFilePath,
  type Action,
  type Load,
  type Route,
  type RouteManifest,
  type Router,
} from '../src/router/index';
import { matchRoute } from '../src/router/match';
import { resetRouterState } from '../src/router/state';
import { createSSRContext, createSSRRouterContext } from '../src/ssr/index';

afterEach(() => {
  resetRouterState();
});

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const route = (overrides: Partial<Route>): Route => ({
  path: '/',
  params: {},
  query: {},
  matched: null,
  hash: '',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Path conversion
// ---------------------------------------------------------------------------
describe('filePathToRoutePattern', () => {
  it('maps an index file to the root path', () => {
    expect(filePathToRoutePattern('routes/index.ts')).toBe('/');
    expect(filePathToRoutePattern('./routes/+page.ts')).toBe('/');
  });

  it('maps dynamic param folders to :param patterns', () => {
    expect(filePathToRoutePattern('routes/users/[id]/+page.ts')).toBe('/users/:id');
  });

  it('maps catch-all folders to a wildcard', () => {
    const parsed = parseFilePath('routes/files/[...path]/+page.ts');
    expect(parsed?.pattern).toBe('/files/*');
    expect(parsed?.catchAll).toBe(true);
    expect(parsed?.paramNames).toEqual(['path']);
  });

  it('drops pathless (group) folders from the URL', () => {
    expect(filePathToRoutePattern('routes/(marketing)/about/+page.ts')).toBe('/about');
  });

  it('supports flat, named page files (Next/Nuxt style)', () => {
    expect(filePathToRoutePattern('routes/blog/[slug].ts')).toBe('/blog/:slug');
    expect(filePathToRoutePattern('routes/about.ts')).toBe('/about');
  });

  it('classifies layouts and server files by kind', () => {
    expect(parseFilePath('routes/+layout.ts')?.kind).toBe('layout');
    expect(parseFilePath('routes/api/users/+server.ts')?.kind).toBe('server');
  });

  it('skips unrecognised reserved/partial files', () => {
    expect(parseFilePath('routes/_helper.ts')).toBeNull();
    expect(parseFilePath('routes/+error.ts')).toBeNull();
  });

  it('honours a custom routesDir', () => {
    expect(filePathToRoutePattern('src/pages/team/+page.ts', { routesDir: 'src/pages' })).toBe(
      '/team'
    );
  });
});

// ---------------------------------------------------------------------------
// createFileRoutes
// ---------------------------------------------------------------------------
describe('createFileRoutes', () => {
  it('builds route definitions with load/action on meta', () => {
    const load: Load = () => ({ ok: true });
    const action: Action = () => ({ done: true });
    const { routes, entries } = createFileRoutes({
      'routes/index.ts': { default: 'Home' },
      'routes/users/[id]/+page.ts': { default: 'User', load, action },
    });

    const userRoute = routes.find((r) => r.path === '/users/:id');
    expect(userRoute).toBeDefined();
    expect((userRoute?.meta as { load?: unknown }).load).toBe(load);
    expect((userRoute?.meta as { action?: unknown }).action).toBe(action);

    const userEntry = entries.find((e) => e.pattern === '/users/:id');
    expect(userEntry?.hasLoad).toBe(true);
    expect(userEntry?.hasAction).toBe(true);
    expect(entries.find((e) => e.pattern === '/')?.hasAction).toBe(false);
  });

  it('sorts static routes ahead of dynamic and catch-all ones', () => {
    const manifest: RouteManifest = {
      'routes/users/[id]/+page.ts': { default: 'User' },
      'routes/users/new/+page.ts': { default: 'New' },
      'routes/[...all]/+page.ts': { default: 'Catch' },
    };
    const { routes } = createFileRoutes(manifest);

    // Static '/users/new' must be matched before the dynamic '/users/:id'.
    const matched = matchRoute('/users/new', routes);
    expect(matched?.matched.path).toBe('/users/new');

    // The catch-all sorts last.
    expect(routes[routes.length - 1].path).toBe('/*');
    // And still matches an otherwise-unmatched path.
    expect(matchRoute('/anything/else', routes)?.matched.path).toBe('/*');
  });

  it('resolves components and loaders from a lazy manifest', async () => {
    const mod = { default: 'LazyUser', load: (() => ({ lazy: true })) as Load };
    const { routes, entries } = createFileRoutes({
      'routes/users/[id]/+page.ts': () => Promise.resolve(mod),
    });

    const entry = entries[0];
    expect(entry.hasLoad).toBeUndefined(); // unknown until imported
    expect(await entry.component()).toBe('LazyUser');

    const load = getRouteLoad(routes[0].meta ? ({ matched: routes[0] } as Route) : null);
    expect(typeof load).toBe('function');
    expect(await load?.({ params: { id: '1' }, url: new URL('http://x/users/1') })).toEqual({
      lazy: true,
    });
  });

  it('computes the layout chain for nested pages', () => {
    const { entries } = createFileRoutes({
      'routes/+layout.ts': { default: 'Root' },
      'routes/dashboard/+layout.ts': { default: 'DashLayout' },
      'routes/dashboard/stats/+page.ts': { default: 'Stats' },
    });
    const stats = entries.find((e) => e.pattern === '/dashboard/stats');
    expect(stats?.layouts).toEqual(['/', '/dashboard']);
  });
});

// ---------------------------------------------------------------------------
// getRouteLoad / getRouteAction
// ---------------------------------------------------------------------------
describe('getRouteLoad / getRouteAction', () => {
  it('reads load/action from a matched Route', () => {
    const load: Load = () => 1;
    const { routes } = createFileRoutes({ 'routes/x/+page.ts': { default: 'X', load } });
    const matched = routes[0];
    expect(getRouteLoad(route({ matched }))).toBe(load);
    expect(getRouteAction(route({ matched }))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createRouteData (client loader binding)
// ---------------------------------------------------------------------------
describe('createRouteData', () => {
  it('runs the matched route load on navigation and exposes data', async () => {
    const { routes } = createFileRoutes({
      'routes/users/[id]/+page.ts': {
        default: 'User',
        load: (({ params }) => ({ id: params.id })) as Load,
      },
    });
    const current = signal<Route>(route({ path: '/', matched: null }));
    const router = { currentRoute: current } as unknown as Router;

    const data = createRouteData<{ id: string }>(router, {
      urlFor: (r) => new URL(`http://localhost${r.path}`),
    });

    current.value = route({ path: '/users/7', params: { id: '7' }, matched: routes[0] });
    await flush();
    expect(data.data.value).toEqual({ id: '7' });
    expect(data.pending.value).toBe(false);
    data.destroy();
  });

  it('clears data for routes without a loader', async () => {
    const { routes } = createFileRoutes({ 'routes/plain/+page.ts': { default: 'Plain' } });
    const current = signal<Route>(route({ path: '/plain', matched: routes[0] }));
    const router = { currentRoute: current } as unknown as Router;
    const data = createRouteData(router);
    await flush();
    expect(data.data.value).toBeUndefined();
    data.destroy();
  });

  it('captures loader errors without throwing', async () => {
    const { routes } = createFileRoutes({
      'routes/boom/+page.ts': {
        default: 'Boom',
        load: (() => {
          throw new Error('kaboom');
        }) as Load,
      },
    });
    const current = signal<Route>(route({ path: '/boom', matched: routes[0] }));
    const data = createRouteData({ currentRoute: current } as unknown as Router);
    await flush();
    expect((data.error.value as Error).message).toBe('kaboom');
    data.destroy();
  });
});

// ---------------------------------------------------------------------------
// SSR router bridge recognises meta.load
// ---------------------------------------------------------------------------
describe('SSR bridge + file-route load', () => {
  it('runs a file-route load during createSSRRouterContext', async () => {
    const { routes } = createFileRoutes({
      'routes/users/[id]/+page.ts': {
        default: 'User',
        load: (({ params, url }) => ({ id: params.id, q: url.searchParams.get('q') })) as Load,
      },
    });

    const ctx = createSSRContext({ url: 'http://localhost/users/42?q=hi' });
    const result = await createSSRRouterContext({
      url: 'http://localhost/users/42?q=hi',
      routes,
      ctx,
    });

    expect(result.matched).toBe(true);
    expect(result.data).toEqual({ id: '42', q: 'hi' });
    expect((result.bindings as { data?: unknown }).data).toEqual({ id: '42', q: 'hi' });
  });
});
