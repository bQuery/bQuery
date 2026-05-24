/**
 * Router 1.14.0 expansion tests — strictly additive surface.
 */

import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import {
  createRouter,
  useNavigation,
  type NavigationResult,
  type RouteDefinition,
  type Router,
} from '../src/router/index';
import { resetNavigationState } from '../src/router/state';

const TEST_ORIGIN = 'http://localhost';

afterEach(() => {
  resetNavigationState();
});

// ---------------------------------------------------------------------------
// Minimal mocked history/location helper — kept small on purpose.
// ---------------------------------------------------------------------------
const setupMockHistory = (initial = '/') => {
  let url = initial;
  const createLoc = (u: string) => {
    const full = u.startsWith('http') ? u : `${TEST_ORIGIN}${u}`;
    const parsed = new URL(full);
    return {
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      href: parsed.href,
      origin: parsed.origin,
      host: parsed.host,
      hostname: parsed.hostname,
      port: parsed.port,
      protocol: parsed.protocol,
    };
  };
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
  let mockLocation = createLoc(url);
  Object.defineProperty(window, 'location', {
    get: () => mockLocation,
    set: (v) => {
      mockLocation = v;
    },
    configurable: true,
  });

  const pushSpy = spyOn(history, 'pushState').mockImplementation(
    (_s: unknown, _t: string, target: string | URL | null | undefined) => {
      url = String(target);
      mockLocation = createLoc(url);
    }
  );
  const replaceSpy = spyOn(history, 'replaceState').mockImplementation(
    (_s: unknown, _t: string, target: string | URL | null | undefined) => {
      url = String(target);
      mockLocation = createLoc(url);
    }
  );

  return {
    restore: () => {
      pushSpy.mockRestore();
      replaceSpy.mockRestore();
      if (originalDescriptor) {
        Object.defineProperty(window, 'location', originalDescriptor);
      }
    },
  };
};

describe('Router 1.14.0 expansion', () => {
  let router: Router | null = null;
  let history: ReturnType<typeof setupMockHistory>;

  const setup = (routes: RouteDefinition[]) => {
    history = setupMockHistory('/');
    router = createRouter({ routes });
  };

  afterEach(() => {
    router?.destroy();
    router = null;
    history?.restore();
  });

  describe('pushResult / replaceResult', () => {
    it('returns a NavigationResult with status="completed" on success', async () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/about', component: () => 'about' },
      ]);
      const result = await router!.pushResult('/about');
      expect(result.status).toBe('completed');
      expect(result.requestedPath).toBe('/about');
      expect(result.to?.path).toBe('/about');
    });

    it('returns status="canceled" when a beforeEach guard returns false', async () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/protected', component: () => 'protected' },
      ]);
      router!.beforeEach((to) => (to.path === '/protected' ? false : undefined));
      const result = await router!.pushResult('/protected');
      expect(result.status).toBe('canceled');
      expect(result.to?.path).toBe('/protected');
    });

    it('returns status="canceled" when a beforeEnter guard returns false', async () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/admin', component: () => 'admin', beforeEnter: () => false },
      ]);
      const result = await router!.pushResult('/admin');
      expect(result.status).toBe('canceled');
    });

    it('updates router.lastNavigation reactively', async () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/about', component: () => 'about' },
      ]);
      expect(router!.lastNavigation.value).toBeNull();
      await router!.pushResult('/about');
      expect(router!.lastNavigation.value?.status).toBe('completed');
      expect(router!.lastNavigation.value?.to?.path).toBe('/about');
    });

    it('reports status="redirected" when a route uses redirectTo', async () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/old', redirectTo: '/new' },
        { path: '/new', component: () => 'new' },
      ]);
      const result = await router!.pushResult('/old');
      expect(result.status).toBe('redirected');
      expect(result.to?.path).toBe('/new');
    });
  });

  describe('beforeResolve', () => {
    it('runs after beforeEach and before history commit', async () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/dashboard', component: () => 'dashboard' },
      ]);
      const order: string[] = [];
      router!.beforeEach(() => {
        order.push('beforeEach');
      });
      router!.beforeResolve(() => {
        order.push('beforeResolve');
      });
      router!.afterEach(() => {
        order.push('afterEach');
      });
      await router!.push('/dashboard');
      expect(order).toEqual(['beforeEach', 'beforeResolve', 'afterEach']);
    });

    it('cancels navigation when returning false', async () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/x', component: () => 'x' },
      ]);
      router!.beforeResolve(() => false);
      const result = await router!.pushResult('/x');
      expect(result.status).toBe('canceled');
    });

    it('returns an unsubscribe function', async () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/y', component: () => 'y' },
      ]);
      const off = router!.beforeResolve(() => false);
      off();
      const result = await router!.pushResult('/y');
      expect(result.status).toBe('completed');
    });
  });

  describe('resolveRoute', () => {
    it('resolves a raw string path with query and hash', () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/users/:id', name: 'user', component: () => 'user' },
      ]);
      const info = router!.resolveRoute('/users/42?tab=info#bio');
      expect(info.path).toBe('/users/42?tab=info#bio');
      expect(info.href).toBe('/users/42?tab=info#bio');
      expect(info.matched?.name).toBe('user');
    });

    it('resolves a named route with params, query, and hash', () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/users/:id', name: 'user', component: () => 'user' },
      ]);
      const info = router!.resolveRoute({
        name: 'user',
        params: { id: '7' },
        query: { tab: 'info', tag: ['a', 'b'] },
        hash: 'bio',
      });
      expect(info.path).toBe('/users/7?tab=info&tag=a&tag=b#bio');
      expect(info.matched?.name).toBe('user');
    });

    it('throws when given neither name nor path', () => {
      setup([{ path: '/', component: () => 'home' }]);
      expect(() => router!.resolveRoute({})).toThrow();
    });
  });

  describe('hasRoute / addRoute / removeRoute', () => {
    it('hasRoute returns false for unknown names and true after addRoute', () => {
      setup([{ path: '/', component: () => 'home' }]);
      expect(router!.hasRoute('settings')).toBe(false);
      router!.addRoute(undefined, {
        path: '/settings',
        name: 'settings',
        component: () => 'settings',
      });
      expect(router!.hasRoute('settings')).toBe(true);
    });

    it('removeRoute removes the named route and returns true', () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/x', name: 'x', component: () => 'x' },
      ]);
      expect(router!.removeRoute('x')).toBe(true);
      expect(router!.hasRoute('x')).toBe(false);
      expect(router!.removeRoute('nope')).toBe(false);
    });

    it('addRoute with parentName nests under the parent', () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/section', name: 'section', component: () => 'section' },
      ]);
      router!.addRoute('section', {
        path: '/details',
        name: 'details',
        component: () => 'details',
      });
      expect(router!.hasRoute('details')).toBe(true);
      const info = router!.resolveRoute('/section/details');
      expect(info.matched?.name).toBe('details');
    });

    it('addRoute throws for an unknown parent', () => {
      setup([{ path: '/', component: () => 'home' }]);
      expect(() =>
        router!.addRoute('unknown', {
          path: '/c',
          name: 'c',
          component: () => 'c',
        })
      ).toThrow();
    });

    it('addRoute replaces an existing route with the same name', () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/v1', name: 'item', component: () => 'v1' },
      ]);
      router!.addRoute(undefined, {
        path: '/v2',
        name: 'item',
        component: () => 'v2',
      });
      const info = router!.resolveRoute('/v2');
      expect(info.matched?.name).toBe('item');
      const v1Info = router!.resolveRoute('/v1');
      expect(v1Info.matched).toBeNull();
    });
  });

  describe('isReady', () => {
    it('resolves after construction', async () => {
      setup([{ path: '/', component: () => 'home' }]);
      await router!.isReady();
      // Calling again should still resolve immediately.
      await router!.isReady();
    });
  });

  describe('useNavigation', () => {
    it('exposes reactive last-navigation signals', async () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/a', component: () => 'a' },
      ]);
      const nav = useNavigation();
      expect(nav.status.value).toBeNull();
      await router!.push('/a');
      expect(nav.status.value).toBe('completed');
      expect(nav.to.value?.path).toBe('/a');
    });

    it('reports error status when a navigation throws', async () => {
      setup([
        { path: '/', component: () => 'home' },
        { path: '/loop', redirectTo: '/loop' },
      ]);
      const nav = useNavigation();
      let threw: unknown = null;
      try {
        await router!.push('/loop');
      } catch (err) {
        threw = err;
      }
      expect(threw).not.toBeNull();
      expect(nav.status.value).toBe('error');
      const result = router!.lastNavigation.value as NavigationResult | null;
      expect(result?.status).toBe('error');
      expect(result?.error).toBeDefined();
    });
  });
});
