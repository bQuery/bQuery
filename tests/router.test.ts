/**
 * Router module tests
 *
 * These tests use a mocked History API to test router functionality
 * in the happy-dom environment.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { clearRouteConstraintCache, getRouteConstraintRegex } from '../src/router/constraints';
import {
  back,
  BqLinkElement,
  createRouter,
  currentRoute,
  forward,
  interceptLinks,
  isActive,
  isActiveSignal,
  link,
  navigate,
  registerBqLink,
  resolve,
  type Route,
  type RouteDefinition,
  type Router,
} from '../src/router/index';
import { matchRoute } from '../src/router/match';

// ============================================================================
// Test Setup - Mock History API and Location
// ============================================================================

const TEST_ORIGIN = 'http://localhost';
const expectType = <T>(_value: T): void => {};

afterEach(() => {
  clearRouteConstraintCache();
});

/**
 * Helper to setup mocked window.location and history for router tests.
 * Uses property descriptor preservation for reliable cleanup.
 */
const setupMockHistory = () => {
  const historyStack: { state: unknown; url: string }[] = [{ state: {}, url: '/' }];
  let currentIndex = 0;
  let isRestored = false;

  // Create a mock location object
  const createMockLocation = (url: string) => {
    const fullUrl = url.startsWith('http') ? url : `${TEST_ORIGIN}${url}`;
    const parsed = new URL(fullUrl);
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

  // Store original location descriptor for reliable restoration
  const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
  const originalLocationValue = window.location;

  // Track current mock location to avoid repeated Object.defineProperty calls
  let currentMockLocation = createMockLocation('/');

  // Set initial location using a getter for more stable mocking
  Object.defineProperty(window, 'location', {
    get: () => currentMockLocation,
    set: (value) => {
      currentMockLocation = value;
    },
    configurable: true,
  });

  const updateLocation = (url: string) => {
    if (!isRestored) {
      currentMockLocation = createMockLocation(url);
    }
  };

  // Mock pushState
  const pushStateSpy = spyOn(history, 'pushState').mockImplementation(
    (state: unknown, _unused: string, url: string | URL | null | undefined) => {
      currentIndex++;
      historyStack.splice(currentIndex, historyStack.length - currentIndex, {
        state,
        url: String(url),
      });
      updateLocation(String(url));
    }
  );

  // Mock replaceState
  const replaceStateSpy = spyOn(history, 'replaceState').mockImplementation(
    (state: unknown, _unused: string, url: string | URL | null | undefined) => {
      historyStack[currentIndex] = { state, url: String(url) };
      updateLocation(String(url));
    }
  );

  // Mock back
  const backSpy = spyOn(history, 'back').mockImplementation(() => {
    if (currentIndex > 0) {
      currentIndex--;
      updateLocation(historyStack[currentIndex].url);
      window.dispatchEvent(
        new PopStateEvent('popstate', { state: historyStack[currentIndex].state })
      );
    }
  });

  // Mock forward
  const forwardSpy = spyOn(history, 'forward').mockImplementation(() => {
    if (currentIndex < historyStack.length - 1) {
      currentIndex++;
      updateLocation(historyStack[currentIndex].url);
      window.dispatchEvent(
        new PopStateEvent('popstate', { state: historyStack[currentIndex].state })
      );
    }
  });

  // Mock go
  const goSpy = spyOn(history, 'go').mockImplementation((delta: number | undefined) => {
    const newIndex = currentIndex + (delta ?? 0);
    if (newIndex >= 0 && newIndex < historyStack.length) {
      currentIndex = newIndex;
      updateLocation(historyStack[currentIndex].url);
      window.dispatchEvent(
        new PopStateEvent('popstate', { state: historyStack[currentIndex].state })
      );
    }
  });

  const restore = () => {
    if (isRestored) return; // Prevent double restoration
    isRestored = true;

    // Restore spies first
    pushStateSpy.mockRestore();
    replaceStateSpy.mockRestore();
    backSpy.mockRestore();
    forwardSpy.mockRestore();
    goSpy.mockRestore();

    // Restore original location using the preserved descriptor
    if (originalLocationDescriptor) {
      Object.defineProperty(window, 'location', originalLocationDescriptor);
    } else {
      // Fallback: set value directly if descriptor wasn't available
      Object.defineProperty(window, 'location', {
        value: originalLocationValue,
        writable: true,
        configurable: true,
      });
    }
  };

  return {
    restore,
    getStack: () => historyStack,
    getCurrentIndex: () => currentIndex,
    updateLocation,
  };
};

// ============================================================================
// Module Export Tests
// ============================================================================

describe('Router', () => {
  describe('route constraint cache', () => {
    it('clears cached compiled regexes on demand', () => {
      const first = getRouteConstraintRegex('\\d+');
      const second = getRouteConstraintRegex('\\d+');

      expect(second).toBe(first);

      clearRouteConstraintCache();

      const third = getRouteConstraintRegex('\\d+');
      expect(third).not.toBe(first);
    });

    it('evicts old constraint entries once the cache cap is exceeded', () => {
      const first = getRouteConstraintRegex('value-0');

      for (let i = 1; i <= 128; i++) {
        getRouteConstraintRegex(`value-${i}`);
      }

      const afterEviction = getRouteConstraintRegex('value-0');
      expect(afterEviction).not.toBe(first);
    });
  });

  describe('module exports', () => {
    it('should export createRouter', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.createRouter).toBe('function');
    });

    it('should export navigate', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.navigate).toBe('function');
    });

    it('should export back and forward', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.back).toBe('function');
      expect(typeof mod.forward).toBe('function');
    });

    it('should export resolve', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.resolve).toBe('function');
    });

    it('should export isActive and isActiveSignal', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.isActive).toBe('function');
      expect(typeof mod.isActiveSignal).toBe('function');
    });

    it('should export link and interceptLinks', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.link).toBe('function');
      expect(typeof mod.interceptLinks).toBe('function');
    });

    it('should export currentRoute signal', async () => {
      const mod = await import('../src/router/index');
      expect(mod.currentRoute).toBeDefined();
      expect(typeof mod.currentRoute.value).toBe('object');
    });
  });

  // ============================================================================
  // Route Matching and Parameter Extraction Tests
  // ============================================================================

  describe('route matching and parameter extraction', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should match exact static routes', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
          { path: '/contact', component: () => null },
        ],
      });

      expect(currentRoute.value.path).toBe('/');
      expect(currentRoute.value.matched?.path).toBe('/');

      await router.push('/about');
      expect(currentRoute.value.path).toBe('/about');
      expect(currentRoute.value.matched?.path).toBe('/about');
    });

    it('should extract single route parameter', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/user/:id', component: () => null },
        ],
      });

      await router.push('/user/42');
      expect(currentRoute.value.path).toBe('/user/42');
      expect(currentRoute.value.matched).not.toBeNull();
      expect(currentRoute.value.matched?.path).toBe('/user/:id');
      expect(currentRoute.value.params).toEqual({ id: '42' });
    });

    it('should extract multiple route parameters', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/user/:userId/post/:postId', component: () => null },
        ],
      });

      await router.push('/user/123/post/456');
      expect(currentRoute.value.matched).not.toBeNull();
      expect(currentRoute.value.matched?.path).toBe('/user/:userId/post/:postId');
      expect(currentRoute.value.params).toEqual({ userId: '123', postId: '456' });
    });

    it('should match wildcard routes', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/docs', component: () => null },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      await router.push('/unknown/path');
      expect(currentRoute.value.matched?.name).toBe('notFound');
    });

    it('should handle nested routes', async () => {
      router = createRouter({
        routes: [
          {
            path: '/admin',
            component: () => null,
            children: [
              { path: '/users', component: () => null, name: 'adminUsers' },
              { path: '/settings', component: () => null, name: 'adminSettings' },
            ],
          },
        ],
      });

      await router.push('/admin/users');
      expect(currentRoute.value.matched?.name).toBe('adminUsers');
      expect(currentRoute.value.path).toBe('/admin/users');
    });

    it('should extract hash from URL', async () => {
      router = createRouter({
        routes: [{ path: '/docs', component: () => null }],
      });

      await router.push('/docs#section-1');
      expect(currentRoute.value.hash).toBe('section-1');
    });

    it('should escape regex special characters in path (dot)', async () => {
      router = createRouter({
        routes: [
          { path: '/api/users.json', component: () => null, name: 'usersJson' },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      // Should match exactly /api/users.json
      await router.push('/api/users.json');
      expect(currentRoute.value.matched?.name).toBe('usersJson');

      // Should NOT match /api/usersXjson (unescaped . would match any char)
      await router.push('/api/usersXjson');
      expect(currentRoute.value.matched?.name).toBe('notFound');
    });

    it('should escape regex special characters in path (question mark in segment)', async () => {
      router = createRouter({
        routes: [
          { path: '/faq?help', component: () => null, name: 'faqHelp' },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      // Note: In URL context, ? starts query string, so /faq?help is parsed as path=/faq with query=help
      // This test verifies regex escaping doesn't break, but the path won't contain literal ?
      // For literal ? in path, URL encoding (%3F) would be needed
      await router.push('/faq%3Fhelp');
      // URL decoding happens in the browser, so we test the encoded form matches
      expect(currentRoute.value.path).toBe('/faq%3Fhelp');
    });

    it('should escape regex special characters in path (plus)', async () => {
      router = createRouter({
        routes: [
          { path: '/c++', component: () => null, name: 'cPlusPlus' },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      await router.push('/c++');
      expect(currentRoute.value.matched?.name).toBe('cPlusPlus');

      // /c should NOT match (unescaped + would make 'c' repeatable)
      await router.push('/ccc');
      expect(currentRoute.value.matched?.name).toBe('notFound');
    });

    it('should escape regex special characters in path (parentheses)', async () => {
      router = createRouter({
        routes: [
          { path: '/docs/(beta)', component: () => null, name: 'docsBeta' },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      await router.push('/docs/(beta)');
      expect(currentRoute.value.matched?.name).toBe('docsBeta');

      // Should not cause regex group issues
      await router.push('/docs/beta');
      expect(currentRoute.value.matched?.name).toBe('notFound');
    });

    it('should escape regex special characters in path (brackets)', async () => {
      router = createRouter({
        routes: [
          { path: '/items/[id]', component: () => null, name: 'itemId' },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      await router.push('/items/[id]');
      expect(currentRoute.value.matched?.name).toBe('itemId');

      // [id] should NOT act as a character class
      await router.push('/items/i');
      expect(currentRoute.value.matched?.name).toBe('notFound');
    });

    it('should escape regex special characters in path (pipe)', async () => {
      router = createRouter({
        routes: [
          { path: '/a|b', component: () => null, name: 'aOrB' },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      await router.push('/a|b');
      expect(currentRoute.value.matched?.name).toBe('aOrB');

      // Should NOT match /a or /b separately (unescaped | would be alternation)
      await router.push('/a');
      expect(currentRoute.value.matched?.name).toBe('notFound');
    });

    it('should escape regex special characters while preserving :param patterns', async () => {
      router = createRouter({
        routes: [
          { path: '/file/:name.json', component: () => null, name: 'fileJson' },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      await router.push('/file/config.json');
      expect(currentRoute.value.matched?.name).toBe('fileJson');
      expect(currentRoute.value.params).toEqual({ name: 'config' });

      // Dot should be literal after param
      await router.push('/file/configXjson');
      expect(currentRoute.value.matched?.name).toBe('notFound');
    });

    it('should escape regex special characters while preserving * wildcards', async () => {
      router = createRouter({
        routes: [
          { path: '/docs/*.md', component: () => null, name: 'markdownDocs' },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      await router.push('/docs/readme.md');
      expect(currentRoute.value.matched?.name).toBe('markdownDocs');

      await router.push('/docs/guide/intro.md');
      expect(currentRoute.value.matched?.name).toBe('markdownDocs');

      // Dot in .md should be literal
      await router.push('/docs/readmeXmd');
      expect(currentRoute.value.matched?.name).toBe('notFound');
    });
  });

  // ============================================================================
  // Query String Parsing Tests
  // ============================================================================

  describe('query string parsing', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should parse single query parameters', async () => {
      router = createRouter({
        routes: [{ path: '/search', component: () => null }],
      });

      await router.push('/search?q=hello');
      expect(currentRoute.value.query).toEqual({ q: 'hello' });
    });

    it('should parse multiple query parameters', async () => {
      router = createRouter({
        routes: [{ path: '/search', component: () => null }],
      });

      await router.push('/search?q=hello&page=2&sort=desc');
      expect(currentRoute.value.query).toEqual({
        q: 'hello',
        page: '2',
        sort: 'desc',
      });
    });

    it('should handle duplicate query keys as arrays', async () => {
      router = createRouter({
        routes: [{ path: '/filter', component: () => null }],
      });

      await router.push('/filter?tag=javascript&tag=typescript&tag=bun');
      expect(currentRoute.value.query).toEqual({
        tag: ['javascript', 'typescript', 'bun'],
      });
    });

    it('should handle mixed single and array query params', async () => {
      router = createRouter({
        routes: [{ path: '/filter', component: () => null }],
      });

      await router.push('/filter?page=1&tag=a&tag=b');
      expect(currentRoute.value.query).toEqual({
        page: '1',
        tag: ['a', 'b'],
      });
    });

    it('should handle empty query string', async () => {
      router = createRouter({
        routes: [{ path: '/page', component: () => null }],
      });

      await router.push('/page');
      expect(currentRoute.value.query).toEqual({});
    });
  });

  // ============================================================================
  // Navigation Tests (Push/Replace)
  // ============================================================================

  describe('navigation with push/replace', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should push new entries to history', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page1', component: () => null },
          { path: '/page2', component: () => null },
        ],
      });

      await router.push('/page1');
      await router.push('/page2');

      const stack = mockHistory.getStack();
      expect(stack.length).toBe(3); // Initial + 2 pushes
      expect(stack[1].url).toBe('/page1');
      expect(stack[2].url).toBe('/page2');
    });

    it('should replace current history entry', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page1', component: () => null },
          { path: '/page2', component: () => null },
        ],
      });

      await router.push('/page1');
      await router.replace('/page2');

      const stack = mockHistory.getStack();
      expect(stack.length).toBe(2); // Initial + 1 push, replace doesn't add
      expect(stack[1].url).toBe('/page2');
    });

    it('should navigate using global navigate function with push', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/target', component: () => null },
        ],
      });

      await navigate('/target');
      expect(currentRoute.value.path).toBe('/target');
    });

    it('should navigate using global navigate function with replace', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/target', component: () => null },
        ],
      });

      await navigate('/target', { replace: true });
      expect(currentRoute.value.path).toBe('/target');
      expect(mockHistory.getStack().length).toBe(1); // Replace doesn't add entry
    });

    it('should handle back navigation', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page1', component: () => null },
          { path: '/page2', component: () => null },
        ],
      });

      await router.push('/page1');
      await router.push('/page2');
      expect(currentRoute.value.path).toBe('/page2');

      back();
      // Wait for popstate event to be processed
      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/page1');
    });

    it('should handle forward navigation', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page1', component: () => null },
        ],
      });

      await router.push('/page1');
      back();
      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/');

      forward();
      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/page1');
    });

    it('should throw error when navigating without router', async () => {
      // Destroy any existing router
      router = createRouter({ routes: [{ path: '/', component: () => null }] });
      router.destroy();

      expect(() => navigate('/anywhere')).toThrow('No router initialized');
    });
  });

  // ============================================================================
  // Navigation Guards Tests
  // ============================================================================

  describe('navigation guards (beforeEach/afterEach)', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should call beforeEach guard before navigation', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/protected', component: () => null },
        ],
      });

      const guardCalls: { to: string; from: string }[] = [];
      router.beforeEach((to, from) => {
        guardCalls.push({ to: to.path, from: from.path });
      });

      await router.push('/protected');

      expect(guardCalls).toHaveLength(1);
      expect(guardCalls[0]).toEqual({ to: '/protected', from: '/' });
    });

    it('should cancel navigation when beforeEach returns false', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/admin', component: () => null },
        ],
      });

      router.beforeEach((to) => {
        if (to.path === '/admin') {
          return false; // Block navigation
        }
      });

      await router.push('/admin');
      expect(currentRoute.value.path).toBe('/'); // Should not have navigated
    });

    it('should support async beforeEach guards', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/async', component: () => null },
        ],
      });

      router.beforeEach(async (to) => {
        await new Promise((r) => setTimeout(r, 10));
        return to.path !== '/blocked';
      });

      await router.push('/async');
      expect(currentRoute.value.path).toBe('/async');
    });

    it('should call afterEach hook after navigation', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      const hookCalls: { to: string; from: string }[] = [];
      router.afterEach((to, from) => {
        hookCalls.push({ to: to.path, from: from.path });
      });

      await router.push('/page');

      expect(hookCalls).toHaveLength(1);
      expect(hookCalls[0]).toEqual({ to: '/page', from: '/' });
    });

    it('should allow removing guards with cleanup function', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      let callCount = 0;
      const removeGuard = router.beforeEach(() => {
        callCount++;
      });

      await router.push('/page');
      expect(callCount).toBe(1);

      removeGuard(); // Remove the guard

      await router.push('/');
      expect(callCount).toBe(1); // Should not have been called again
    });

    it('should run multiple guards in order', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      const order: number[] = [];

      router.beforeEach(() => {
        order.push(1);
      });
      router.beforeEach(() => {
        order.push(2);
      });
      router.beforeEach(() => {
        order.push(3);
      });

      await router.push('/page');
      expect(order).toEqual([1, 2, 3]);
    });

    it('should stop at first guard that returns false', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      const order: number[] = [];

      router.beforeEach(() => {
        order.push(1);
      });
      router.beforeEach(() => {
        order.push(2);
        return false;
      });
      router.beforeEach(() => {
        order.push(3); // Should not be reached
      });

      await router.push('/page');
      expect(order).toEqual([1, 2]);
      expect(currentRoute.value.path).toBe('/');
    });

    it('should restore full URL including query and hash when guard cancels popstate navigation', async () => {
      router = createRouter({
        routes: [
          { path: '/page', component: () => null },
          { path: '/other', component: () => null },
        ],
      });

      // Navigate to /page?foo=bar#section
      await router.push('/page?foo=bar#section');
      expect(currentRoute.value.path).toBe('/page');
      expect(currentRoute.value.query.foo).toBe('bar');
      expect(currentRoute.value.hash).toBe('section');

      // Navigate to /other
      await router.push('/other');
      expect(currentRoute.value.path).toBe('/other');

      // Add a guard that blocks navigation
      router.beforeEach(() => false);

      // Try to navigate back with back() - should be blocked by guard
      back();
      await new Promise((r) => setTimeout(r, 0));

      // Should still be on /other
      expect(currentRoute.value.path).toBe('/other');
      expect(currentRoute.value.query).toEqual({});
      expect(currentRoute.value.hash).toBe('');

      // Verify the URL in window.location was restored correctly
      // (The guard should have used replaceState to restore full URL)
      expect(window.location.pathname).toBe('/other');
      expect(window.location.search).toBe('');
      expect(window.location.hash).toBe('');
    });
  });

  // ============================================================================
  // Active Route Detection Tests
  // ============================================================================

  describe('active route detection', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should detect exact active route with isActive', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/dashboard', component: () => null },
        ],
      });

      await router.push('/dashboard');
      expect(isActive('/dashboard', true)).toBe(true);
      expect(isActive('/dash', true)).toBe(false);
    });

    it('should detect prefix match with isActive (non-exact)', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/dashboard/settings', component: () => null },
        ],
      });

      await router.push('/dashboard/settings');
      expect(isActive('/dashboard')).toBe(true);
      expect(isActive('/dashboard', false)).toBe(true);
      expect(isActive('/other')).toBe(false);
    });

    it('should create reactive isActiveSignal', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      const pageActive = isActiveSignal('/page', true);
      expect(pageActive.value).toBe(false);

      await router.push('/page');
      expect(pageActive.value).toBe(true);

      await router.push('/');
      expect(pageActive.value).toBe(false);
    });

    it('should handle prefix matching with isActiveSignal', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/admin/users', component: () => null },
        ],
      });

      const adminActive = isActiveSignal('/admin');

      await router.push('/admin/users');
      expect(adminActive.value).toBe(true);
    });
  });

  // ============================================================================
  // Named Route Resolution Tests
  // ============================================================================

  describe('named route resolution', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should resolve named route without params', () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null, name: 'home' },
          { path: '/about', component: () => null, name: 'about' },
        ],
      });

      expect(resolve('home')).toBe('/');
      expect(resolve('about')).toBe('/about');
    });

    it('should resolve named route with params', () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/user/:id', component: () => null, name: 'user' },
          { path: '/post/:postId/comment/:commentId', component: () => null, name: 'comment' },
        ],
      });

      expect(resolve('user', { id: '42' })).toBe('/user/42');
      expect(resolve('comment', { postId: '100', commentId: '5' })).toBe('/post/100/comment/5');
    });

    it('should encode special characters in params', () => {
      router = createRouter({
        routes: [{ path: '/search/:query', component: () => null, name: 'search' }],
      });

      expect(resolve('search', { query: 'hello world' })).toBe('/search/hello%20world');
    });

    it('should strip param constraints when resolving named routes', () => {
      router = createRouter({
        routes: [{ path: '/user/:id(\\d+)', component: () => null, name: 'user' }],
      });

      expect(resolve('user', { id: '42' })).toBe('/user/42');
    });

    it('should validate resolved params against route constraints', () => {
      router = createRouter({
        routes: [{ path: '/user/:id(\\d+)', component: () => null, name: 'user' }],
      });

      expect(() => resolve('user', { id: 'abc' })).toThrow(
        'Param "id" with value "abc" does not satisfy the route constraint "\\d+" for route "user"'
      );
    });

    it('should throw error when a required param is missing', () => {
      router = createRouter({
        routes: [{ path: '/user/:id(\\d+)', component: () => null, name: 'user' }],
      });

      expect(() => resolve('user')).toThrow('Missing required param "id" for route "user"');
    });

    it('should throw error for invalid param constraint syntax when resolving', () => {
      expect(() =>
        createRouter({
          routes: [{ path: '/user/:id(\\d+', component: () => null, name: 'user' }],
        })
      ).toThrow(
        'bQuery router: Invalid route param constraint syntax in path "/user/:id(\\d+" at index 9.'
      );
    });

    it('should throw error for unknown route name', () => {
      router = createRouter({
        routes: [{ path: '/', component: () => null, name: 'home' }],
      });

      expect(() => resolve('unknown')).toThrow('Route "unknown" not found');
    });

    it('should throw error when no router is initialized', () => {
      router = createRouter({ routes: [{ path: '/', component: () => null }] });
      router.destroy();

      expect(() => resolve('any')).toThrow('No router initialized');
    });

    it('should require routes to define either a component or a redirect target', () => {
      const validRoutes: RouteDefinition[] = [
        { path: '/', component: () => null },
        { path: '/old', redirectTo: '/' },
      ];

      expectType<RouteDefinition[]>(validRoutes);

      // @ts-expect-error route definitions must provide a component or redirectTo
      expectType<RouteDefinition>({ path: '/broken' });
      expect(validRoutes).toHaveLength(2);
    });
  });

  // ============================================================================
  // Link Helper Tests
  // ============================================================================

  describe('link helper', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should create click handler that navigates', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/target', component: () => null },
        ],
      });

      const handler = link('/target');
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefaultSpy = spyOn(event, 'preventDefault');

      handler(event);
      await new Promise((r) => setTimeout(r, 0));

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(currentRoute.value.path).toBe('/target');
    });

    it('should support replace option in link', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/target', component: () => null },
        ],
      });

      const handler = link('/target', { replace: true });
      const event = new MouseEvent('click');

      handler(event);
      await new Promise((r) => setTimeout(r, 0));

      expect(mockHistory.getStack().length).toBe(1); // Replace doesn't add entry
    });
  });

  // ============================================================================
  // interceptLinks Tests
  // ============================================================================

  describe('interceptLinks', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;
    let container: HTMLElement;

    beforeEach(() => {
      mockHistory = setupMockHistory();
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
      container.remove();
    });

    it('should intercept internal link clicks', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/internal', component: () => null },
        ],
      });

      container.innerHTML = '<a href="/internal">Link</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/internal');

      cleanup();
    });

    it('should not intercept links with target attribute', async () => {
      router = createRouter({
        routes: [{ path: '/', component: () => null }],
      });

      container.innerHTML = '<a href="/page" target="_blank">Link</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/'); // Should not navigate

      cleanup();
    });

    it('should not intercept download links', async () => {
      router = createRouter({
        routes: [{ path: '/', component: () => null }],
      });

      container.innerHTML = '<a href="/file.pdf" download>Download</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/'); // Should not navigate

      cleanup();
    });

    it('should return cleanup function that removes listener', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      container.innerHTML = '<a href="/page">Link</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);
      cleanup(); // Remove interceptor immediately

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/'); // Should not navigate after cleanup
    });

    it('should handle hash-routing links with href="#/route"', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/some-route', component: () => null },
          { path: '/page', component: () => null },
        ],
        hash: true,
      });

      // Test hash-routing link with path only
      container.innerHTML = '<a href="#/some-route">Hash Link</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/some-route');

      // Test hash-routing link with query parameters
      container.innerHTML = '<a href="#/page?foo=bar">Hash Link with Query</a>';
      const anchor2 = container.querySelector('a')!;

      const event2 = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor2.dispatchEvent(event2);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/page');
      expect(currentRoute.value.query).toEqual({ foo: 'bar' });

      cleanup();
    });

    it('should strip base path from links in history mode', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
          { path: '/contact', component: () => null },
        ],
        base: '/app',
      });

      // Test link with base path - should strip /app before navigation
      container.innerHTML = '<a href="/app/about">About</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/about');

      // Test link with base path and query string
      container.innerHTML = '<a href="/app/contact?foo=bar">Contact</a>';
      const anchor2 = container.querySelector('a')!;

      const event2 = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor2.dispatchEvent(event2);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/contact');
      expect(currentRoute.value.query).toEqual({ foo: 'bar' });

      cleanup();
    });

    it('should handle base="/" without breaking navigation', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
        base: '/',
      });

      container.innerHTML = '<a href="/page">Page</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/page');

      cleanup();
    });

    it('should not intercept middle-click (button === 1)', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      container.innerHTML = '<a href="/page">Page</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);

      // Middle-click (button 1) should not be intercepted
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/'); // Should not navigate

      cleanup();
    });

    it('should not intercept right-click (button === 2)', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      container.innerHTML = '<a href="/page">Page</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);

      // Right-click (button 2) should not be intercepted
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 2 });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/'); // Should not navigate

      cleanup();
    });

    it('should not intercept Ctrl+click', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      container.innerHTML = '<a href="/page">Page</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);

      // Ctrl+click should not be intercepted (opens in new tab)
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/'); // Should not navigate

      cleanup();
    });

    it('should not intercept Cmd+click (metaKey)', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      container.innerHTML = '<a href="/page">Page</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);

      // Cmd+click (metaKey) should not be intercepted (opens in new tab on Mac)
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        metaKey: true,
      });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/'); // Should not navigate

      cleanup();
    });

    it('should not intercept Shift+click', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      container.innerHTML = '<a href="/page">Page</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);

      // Shift+click should not be intercepted (opens in new window)
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        shiftKey: true,
      });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/'); // Should not navigate

      cleanup();
    });

    it('should not intercept Alt+click', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      container.innerHTML = '<a href="/page">Page</a>';
      const anchor = container.querySelector('a')!;

      const cleanup = interceptLinks(container);

      // Alt+click should not be intercepted
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        altKey: true,
      });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/'); // Should not navigate

      cleanup();
    });

    it('should skip already prevented events', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      container.innerHTML = '<a href="/page">Page</a>';
      const anchor = container.querySelector('a')!;

      // Add another listener that prevents default first
      anchor.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
        },
        { capture: true }
      );

      const cleanup = interceptLinks(container);

      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 0));
      expect(currentRoute.value.path).toBe('/'); // Should not navigate

      cleanup();
    });
  });

  // ============================================================================
  // Router Lifecycle Tests
  // ============================================================================

  describe('router lifecycle', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should initialize with current URL', () => {
      router = createRouter({
        routes: [{ path: '/', component: () => null }],
      });

      expect(currentRoute.value.path).toBe('/');
    });

    it('should expose routes array', () => {
      const routes: RouteDefinition[] = [
        { path: '/', component: () => null, name: 'home' },
        { path: '/about', component: () => null, name: 'about' },
      ];

      router = createRouter({ routes });

      expect(router.routes).toHaveLength(2);
      expect(router.routes[0].name).toBe('home');
      expect(router.routes[1].name).toBe('about');
    });

    it('should destroy router and cleanup guards', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
      });

      router.beforeEach(() => true);

      router.destroy();

      // After destroy, navigate should throw (no active router)
      expect(() => navigate('/page')).toThrow('No router initialized');
    });

    it('should replace previous router when creating new one', async () => {
      const router1 = createRouter({
        routes: [{ path: '/', component: () => null }],
      });

      let guard1Called = false;
      router1.beforeEach(() => {
        guard1Called = true;
      });

      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/test', component: () => null },
        ],
      });

      await router.push('/test');
      expect(guard1Called).toBe(false); // Old guard should not be called
    });

    it('should handle route metadata', () => {
      router = createRouter({
        routes: [
          {
            path: '/admin',
            component: () => null,
            meta: { requiresAuth: true, role: 'admin' },
          },
        ],
      });

      expect(router.routes[0].meta).toEqual({ requiresAuth: true, role: 'admin' });
    });
  });

  // ============================================================================
  // Base Path Tests
  // ============================================================================

  describe('base path handling', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should prepend base path to navigation', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
        base: '/app',
      });

      await router.push('/page');

      const stack = mockHistory.getStack();
      expect(stack[stack.length - 1].url).toBe('/app/page');
    });

    it('should flatten nested routes without including base path', () => {
      router = createRouter({
        routes: [
          {
            path: '/parent',
            component: () => null,
            children: [{ path: '/child', component: () => null, name: 'child' }],
          },
        ],
        base: '/app',
      });

      expect(router.routes).toHaveLength(2);
      // Routes should not include base - base is only for browser history
      expect(router.routes[1].path).toBe('/parent/child');
    });
  });

  // ============================================================================
  // Hash Routing Tests
  // ============================================================================

  describe('hash routing mode', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should handle basic hash routing navigation', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
          { path: '/about', component: () => null },
        ],
        hash: true,
      });

      // Initial route should be /
      expect(currentRoute.value.path).toBe('/');

      // Navigate to /page
      await router.push('/page');
      expect(currentRoute.value.path).toBe('/page');

      // Verify the URL was updated with hash
      const stack = mockHistory.getStack();
      expect(stack[stack.length - 1].url).toBe('#/page');

      // Navigate to /about
      await router.push('/about');
      expect(currentRoute.value.path).toBe('/about');
      expect(stack[stack.length - 1].url).toBe('#/about');
    });

    it('should handle hash routing with query parameters', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
        hash: true,
      });

      // Navigate to /page with query parameters
      await router.push('/page?foo=bar&baz=qux');

      // Verify route matching works correctly (pathname should be /page)
      expect(currentRoute.value.path).toBe('/page');
      expect(currentRoute.value.query).toEqual({ foo: 'bar', baz: 'qux' });

      // Verify the URL includes the hash with query
      const stack = mockHistory.getStack();
      expect(stack[stack.length - 1].url).toBe('#/page?foo=bar&baz=qux');
    });

    it('should handle hash routing with hash fragments', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
        hash: true,
      });

      // Navigate to /page with a hash fragment
      await router.push('/page#section');

      // Verify route matching works correctly (pathname should be /page)
      expect(currentRoute.value.path).toBe('/page');
      expect(currentRoute.value.hash).toBe('section');

      // Verify the URL includes hash routing prefix (#) and hash fragment
      const stack = mockHistory.getStack();
      expect(stack[stack.length - 1].url).toBe('#/page#section');
    });

    it('should handle hash routing with both query parameters and hash fragments', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
          { path: '/user/:id', component: () => null },
        ],
        hash: true,
      });

      // Navigate to /page with both query and hash
      await router.push('/page?foo=bar&baz=qux#section');

      // Verify route matching works correctly
      expect(currentRoute.value.path).toBe('/page');
      expect(currentRoute.value.query).toEqual({ foo: 'bar', baz: 'qux' });
      expect(currentRoute.value.hash).toBe('section');

      // Verify the URL is correct
      const stack = mockHistory.getStack();
      expect(stack[stack.length - 1].url).toBe('#/page?foo=bar&baz=qux#section');

      // Also test with a parameterized route
      await router.push('/user/123?tab=profile#bio');
      expect(currentRoute.value.path).toBe('/user/123');
      expect(currentRoute.value.params).toEqual({ id: '123' });
      expect(currentRoute.value.query).toEqual({ tab: 'profile' });
      expect(currentRoute.value.hash).toBe('bio');
    });

    it('should handle hash routing with route parameters and query strings', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/user/:id', component: () => null },
          { path: '/product/:category/:id', component: () => null },
        ],
        hash: true,
      });

      // Single parameter with query
      await router.push('/user/42?tab=posts&page=2');
      expect(currentRoute.value.path).toBe('/user/42');
      expect(currentRoute.value.params).toEqual({ id: '42' });
      expect(currentRoute.value.query).toEqual({ tab: 'posts', page: '2' });

      // Multiple parameters with query and hash
      await router.push('/product/electronics/456?color=blue&size=large#specs');
      expect(currentRoute.value.path).toBe('/product/electronics/456');
      expect(currentRoute.value.params).toEqual({ category: 'electronics', id: '456' });
      expect(currentRoute.value.query).toEqual({ color: 'blue', size: 'large' });
      expect(currentRoute.value.hash).toBe('specs');
    });

    it('should properly handle navigation guards in hash mode with query params', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
          { path: '/admin', component: () => null },
        ],
        hash: true,
      });

      let guardCalled = false;
      let guardToRoute: Route | null = null;

      router.beforeEach((to) => {
        guardCalled = true;
        guardToRoute = to;
        return true;
      });

      // Navigate with query parameters
      await router.push('/page?foo=bar#section');

      // Verify guard was called with properly parsed route
      expect(guardCalled).toBe(true);
      expect(guardToRoute).not.toBeNull();
      expect(guardToRoute!.path).toBe('/page');
      expect(guardToRoute!.query).toEqual({ foo: 'bar' });
      expect(guardToRoute!.hash).toBe('section');
    });

    it('should handle replace mode in hash routing', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page1', component: () => null },
          { path: '/page2', component: () => null },
        ],
        hash: true,
      });

      await router.push('/page1?test=1');
      const stackLengthAfterPush = mockHistory.getStack().length;

      await router.replace('/page2?test=2#section');
      const stackLengthAfterReplace = mockHistory.getStack().length;

      // Replace should not add a new history entry
      expect(stackLengthAfterReplace).toBe(stackLengthAfterPush);

      // But should update the route correctly
      expect(currentRoute.value.path).toBe('/page2');
      expect(currentRoute.value.query).toEqual({ test: '2' });
      expect(currentRoute.value.hash).toBe('section');
    });
  });

  // ============================================================================
  // Route Params with Type Coercion (Regex Constraints)
  // ============================================================================

  describe('route params with regex constraints', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should match params with \\d+ constraint', async () => {
      router = createRouter({
        routes: [
          { path: '/user/:id(\\d+)', component: () => null },
          { path: '*', component: () => null },
        ],
      });

      await router.push('/user/42');
      expect(currentRoute.value.path).toBe('/user/42');
      expect(currentRoute.value.params).toEqual({ id: '42' });
      expect(currentRoute.value.matched?.path).toBe('/user/:id(\\d+)');
    });

    it('should not match when constraint fails', async () => {
      router = createRouter({
        routes: [
          { path: '/user/:id(\\d+)', component: () => null },
          { path: '*', component: () => null },
        ],
      });

      await router.push('/user/abc');
      // Should NOT match the constrained route
      expect(currentRoute.value.matched?.path).toBe('*');
    });

    it('should support [a-z-]+ constraint', async () => {
      router = createRouter({
        routes: [
          { path: '/post/:slug([a-z-]+)', component: () => null },
          { path: '*', component: () => null },
        ],
      });

      await router.push('/post/hello-world');
      expect(currentRoute.value.params).toEqual({ slug: 'hello-world' });
      expect(currentRoute.value.matched?.path).toBe('/post/:slug([a-z-]+)');

      await router.push('/post/ABC');
      expect(currentRoute.value.matched?.path).toBe('*');
    });

    it('should support multiple constrained params', async () => {
      router = createRouter({
        routes: [
          { path: '/date/:year(\\d{4})/:month(\\d{2})', component: () => null },
          { path: '*', component: () => null },
        ],
      });

      await router.push('/date/2026/03');
      expect(currentRoute.value.params).toEqual({ year: '2026', month: '03' });

      await router.push('/date/26/3');
      // 26 doesn't match \d{4}, 3 doesn't match \d{2}
      expect(currentRoute.value.matched?.path).toBe('*');
    });

    it('should ignore nested capturing groups inside param constraints when extracting params', async () => {
      router = createRouter({
        routes: [
          { path: '/item/:slug((foo|bar)-\\d+)', component: () => null },
          { path: '*', component: () => null },
        ],
      });

      await router.push('/item/foo-42');
      expect(currentRoute.value.params).toEqual({ slug: 'foo-42' });
      expect(currentRoute.value.matched?.path).toBe('/item/:slug((foo|bar)-\\d+)');
    });

    it('should ignore named capturing groups inside param constraints when extracting params', async () => {
      router = createRouter({
        routes: [
          { path: '/item/:slug((?<prefix>foo|bar)-\\d+)', component: () => null },
          { path: '*', component: () => null },
        ],
      });

      await router.push('/item/bar-42');
      expect(currentRoute.value.params).toEqual({ slug: 'bar-42' });
      expect(currentRoute.value.matched?.path).toBe('/item/:slug((?<prefix>foo|bar)-\\d+)');
    });

    it('should reject constraints that use backreferences', () => {
      expect(() =>
        createRouter({
          routes: [{ path: '/item/:slug((foo|bar)-\\1)', component: () => null }],
        })
      ).toThrow(
        'bQuery router: Route constraints cannot use backreferences: "(foo|bar)-\\1".'
      );
    });

    it('should reject constraints that use named backreferences (\\k<name>)', () => {
      expect(() =>
        getRouteConstraintRegex('(?<word>[a-z]+)-\\k<word>')
      ).toThrow(
        'bQuery router: Route constraints cannot use backreferences: "(?<word>[a-z]+)-\\k<word>".'
      );
    });

    it('should reject constraints with nested quantifiers (ReDoS protection)', () => {
      expect(() => getRouteConstraintRegex('(a+)+')).toThrow(
        'bQuery router: Route constraint contains a potentially catastrophic (ReDoS) pattern. Nested quantifiers are not allowed: "(a+)+".'
      );
      expect(() => getRouteConstraintRegex('(a*)*')).toThrow(
        'bQuery router: Route constraint contains a potentially catastrophic (ReDoS) pattern. Nested quantifiers are not allowed: "(a*)*".'
      );
      expect(() => getRouteConstraintRegex('(\\d*)*')).toThrow(
        'bQuery router: Route constraint contains a potentially catastrophic (ReDoS) pattern. Nested quantifiers are not allowed: "(\\d*)*".'
      );
      expect(() => getRouteConstraintRegex('(a+){2,}')).toThrow(
        'bQuery router: Route constraint contains a potentially catastrophic (ReDoS) pattern. Nested quantifiers are not allowed: "(a+){2,}".'
      );
    });

    it('should reject nested quantifiers even when later nested groups would previously clear state', () => {
      expect(() => getRouteConstraintRegex('(a(b+)(c))+')).toThrow(
        'bQuery router: Route constraint contains a potentially catastrophic (ReDoS) pattern. Nested quantifiers are not allowed: "(a(b+)(c))+".'
      );
      expect(() => getRouteConstraintRegex('(ab(c+)(de{2}))+')).toThrow(
        'bQuery router: Route constraint contains a potentially catastrophic (ReDoS) pattern. Nested quantifiers are not allowed: "(ab(c+)(de{2}))+".'
      );
    });

    it('should allow safe constraints without nested quantifiers', () => {
      // Simple character class constraints should work
      expect(() => getRouteConstraintRegex('\\d+')).not.toThrow();
      expect(() => getRouteConstraintRegex('[a-z]+')).not.toThrow();
      expect(() => getRouteConstraintRegex('[a-zA-Z0-9_-]+')).not.toThrow();
      // Non-capturing groups without nesting are fine
      expect(() => getRouteConstraintRegex('(?:foo|bar)')).not.toThrow();
      expect(() => getRouteConstraintRegex('(?:ab)+')).not.toThrow();
      expect(() => getRouteConstraintRegex('(?:a|b)+')).not.toThrow();
      expect(() => getRouteConstraintRegex('(ab){2,4}')).not.toThrow();
      expect(() => getRouteConstraintRegex('(foo(bar|baz))')).not.toThrow();
    });

    it('should wrap invalid constraint regex syntax in a router-specific error with syntax details', () => {
      let thrown: unknown;

      try {
        getRouteConstraintRegex('[a-');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain(
        'bQuery router: Invalid route constraint regex "[a-":'
      );
    });

    it('should throw for invalid param constraint syntax when matching routes', () => {
      expect(() =>
        matchRoute('/user/42', [{ path: '/user/:id(\\d+', component: () => null }])
      ).toThrow(
        'bQuery router: Invalid route param constraint syntax in path "/user/:id(\\d+" at index 9.'
      );
    });

    it('should support literal closing parentheses inside constraint character classes', async () => {
      router = createRouter({
        routes: [
          { path: '/item/:slug([)])/edit', component: () => null },
          { path: '*', component: () => null },
        ],
      });

      await router.push('/item/)/edit');
      expect(currentRoute.value.params).toEqual({ slug: ')' });
      expect(currentRoute.value.matched?.path).toBe('/item/:slug([)])/edit');
    });

    it('should support parentheses inside character classes without rewriting them', async () => {
      router = createRouter({
        routes: [
          { path: '/item/:slug([()]+)', component: () => null },
          { path: '*', component: () => null },
        ],
      });

      await router.push('/item/(()');
      expect(currentRoute.value.params).toEqual({ slug: '(()' });
      expect(currentRoute.value.matched?.path).toBe('/item/:slug([()]+)');
    });

    it('should mix constrained and unconstrained params', async () => {
      router = createRouter({
        routes: [{ path: '/user/:id(\\d+)/:action', component: () => null }],
      });

      await router.push('/user/42/edit');
      expect(currentRoute.value.params).toEqual({ id: '42', action: 'edit' });
    });

    it('should still support basic params without constraints', async () => {
      router = createRouter({
        routes: [{ path: '/user/:id', component: () => null }],
      });

      await router.push('/user/anything-works');
      expect(currentRoute.value.params).toEqual({ id: 'anything-works' });
    });

    it('should match long wildcard paths with literal suffixes', async () => {
      router = createRouter({
        routes: [
          { path: '/docs/*.md', component: () => null, name: 'markdownDocs' },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      const longPath = `/docs/${'guide/'.repeat(200)}intro.md`;
      await router.push(longPath);

      expect(currentRoute.value.matched?.name).toBe('markdownDocs');
      expect(currentRoute.value.path).toBe(longPath);
    });

    it('should match long constrained params followed by literal suffixes', async () => {
      router = createRouter({
        routes: [
          { path: '/file/:id(\\d+).json', component: () => null, name: 'fileJson' },
          { path: '*', component: () => null, name: 'notFound' },
        ],
      });

      const longDigits = '1234567890'.repeat(300);
      await router.push(`/file/${longDigits}.json`);

      expect(currentRoute.value.matched?.name).toBe('fileJson');
      expect(currentRoute.value.params).toEqual({ id: longDigits });
    });
  });

  // ============================================================================
  // redirectTo
  // ============================================================================

  describe('redirectTo', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should redirect to specified path on push', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/old-page', redirectTo: '/new-page' },
          { path: '/new-page', component: () => null },
        ],
      });

      await router.push('/old-page');
      expect(currentRoute.value.path).toBe('/new-page');
      expect(currentRoute.value.matched?.path).toBe('/new-page');
    });

    it('should redirect to specified path on replace', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/legacy', redirectTo: '/modern' },
          { path: '/modern', component: () => null },
        ],
      });

      await router.replace('/legacy');
      expect(currentRoute.value.path).toBe('/modern');
    });

    it('should not require component on redirect routes', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/redirect-only', redirectTo: '/' },
        ],
      });

      await router.push('/redirect-only');
      expect(currentRoute.value.path).toBe('/');
    });

    it('should handle chained redirects', async () => {
      router = createRouter({
        routes: [
          { path: '/a', redirectTo: '/b' },
          { path: '/b', redirectTo: '/c' },
          { path: '/c', component: () => null },
        ],
      });

      await router.push('/a');
      expect(currentRoute.value.path).toBe('/c');
    });

    it('should fail fast on redirect loops', async () => {
      router = createRouter({
        routes: [{ path: '/a', redirectTo: '/a' }],
      });

      await expect(router.push('/a')).rejects.toThrow(/redirect loop/i);
    });
  });

  // ============================================================================
  // beforeEnter (route-level guards)
  // ============================================================================

  describe('beforeEnter guards', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should execute beforeEnter guard before navigation', async () => {
      const calls: string[] = [];

      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          {
            path: '/guarded',
            component: () => null,
            beforeEnter: (to, from) => {
              calls.push(`beforeEnter:${from.path}->${to.path}`);
            },
          },
        ],
      });

      await router.push('/guarded');
      expect(calls).toEqual(['beforeEnter:/->/guarded']);
      expect(currentRoute.value.path).toBe('/guarded');
    });

    it('should cancel navigation when beforeEnter returns false', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          {
            path: '/blocked',
            component: () => null,
            beforeEnter: () => false,
          },
        ],
      });

      await router.push('/blocked');
      expect(currentRoute.value.path).toBe('/');
    });

    it('should support async beforeEnter guards', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          {
            path: '/async',
            component: () => null,
            beforeEnter: async () => {
              await new Promise((r) => setTimeout(r, 10));
              // Allow navigation
            },
          },
        ],
      });

      await router.push('/async');
      expect(currentRoute.value.path).toBe('/async');
    });

    it('should run beforeEnter BEFORE global beforeEach', async () => {
      const calls: string[] = [];

      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          {
            path: '/page',
            component: () => null,
            beforeEnter: () => {
              calls.push('beforeEnter');
            },
          },
        ],
      });

      router.beforeEach(() => {
        calls.push('beforeEach');
      });

      await router.push('/page');
      expect(calls).toEqual(['beforeEnter', 'beforeEach']);
    });

    it('should not run global beforeEach if beforeEnter blocks', async () => {
      const calls: string[] = [];

      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          {
            path: '/blocked',
            component: () => null,
            beforeEnter: () => {
              calls.push('beforeEnter');
              return false;
            },
          },
        ],
      });

      router.beforeEach(() => {
        calls.push('beforeEach');
      });

      await router.push('/blocked');
      expect(calls).toEqual(['beforeEnter']);
      expect(currentRoute.value.path).toBe('/');
    });
  });

  // ============================================================================
  // useRoute composable
  // ============================================================================

  describe('useRoute', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    beforeEach(() => {
      mockHistory = setupMockHistory();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should export useRoute function', async () => {
      const mod = await import('../src/router/index');
      expect(typeof mod.useRoute).toBe('function');
    });

    it('should return reactive path, params, query, hash, matched', async () => {
      const { useRoute } = await import('../src/router/index');

      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/user/:id', component: () => null },
        ],
      });

      const { path, params, query, hash, matched, route } = useRoute();

      expect(path.value).toBe('/');
      expect(params.value).toEqual({});
      expect(query.value).toEqual({});
      expect(hash.value).toBe('');
      expect(route.value.path).toBe('/');

      await router.push('/user/99?tab=profile#top');

      expect(path.value).toBe('/user/99');
      expect(params.value).toEqual({ id: '99' });
      expect(query.value).toEqual({ tab: 'profile' });
      expect(hash.value).toBe('top');
      expect(matched.value?.path).toBe('/user/:id');
    });

    it('should update when route changes', async () => {
      const { useRoute } = await import('../src/router/index');

      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/a', component: () => null },
          { path: '/b', component: () => null },
        ],
      });

      const { path } = useRoute();
      expect(path.value).toBe('/');

      await router.push('/a');
      expect(path.value).toBe('/a');

      await router.push('/b');
      expect(path.value).toBe('/b');
    });

    it('should reuse the same reactive route signals across calls', async () => {
      const { useRoute } = await import('../src/router/index');

      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/a', component: () => null },
        ],
      });

      const first = useRoute();
      const second = useRoute();

      expect(first.route).toBe(second.route);
      expect(first.path).toBe(second.path);
      expect(first.params).toBe(second.params);
      expect(first.query).toBe(second.query);
      expect(first.hash).toBe(second.hash);
      expect(first.matched).toBe(second.matched);
    });
  });

  // ============================================================================
  // Scroll position restoration
  // ============================================================================

  describe('scroll restoration', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;
    let scrollToSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      mockHistory = setupMockHistory();
      scrollToSpy = spyOn(window, 'scrollTo').mockImplementation(() => {});
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
      scrollToSpy.mockRestore();
    });

    it('should scroll to top on push navigation when enabled', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
        scrollRestoration: true,
      });

      await router.push('/page');
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });

    it('should not scroll when scrollRestoration is disabled', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
        scrollRestoration: false,
      });

      await router.push('/page');
      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it('should set history.scrollRestoration to manual when enabled', () => {
      router = createRouter({
        routes: [{ path: '/', component: () => null }],
        scrollRestoration: true,
      });

      expect(history.scrollRestoration).toBe('manual');
    });

    it('should restore history.scrollRestoration to the previous value on destroy', () => {
      history.scrollRestoration = 'manual';
      router = createRouter({
        routes: [{ path: '/', component: () => null }],
        scrollRestoration: true,
      });

      router.destroy();
      expect(history.scrollRestoration).toBe('manual');
    });

    it('should store scroll key in history state', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
        scrollRestoration: true,
      });

      await router.push('/page');
      const stack = mockHistory.getStack();
      const lastEntry = stack[stack.length - 1];
      expect(lastEntry.state).toHaveProperty('__bqScrollKey');
      expect(typeof (lastEntry.state as Record<string, unknown>).__bqScrollKey).toBe('string');
    });

    it('should preserve the same scroll key when using replace navigation', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page1', component: () => null },
          { path: '/page2', component: () => null },
        ],
        scrollRestoration: true,
      });

      await router.push('/page1');
      const stackAfterPush = mockHistory.getStack();
      const keyAfterPush = (
        stackAfterPush[mockHistory.getCurrentIndex()].state as Record<string, unknown>
      ).__bqScrollKey;

      await router.replace('/page2');
      const stackAfterReplace = mockHistory.getStack();
      const keyAfterReplace = (
        stackAfterReplace[mockHistory.getCurrentIndex()].state as Record<string, unknown>
      ).__bqScrollKey;

      expect(keyAfterReplace).toBe(keyAfterPush);
    });

    it('should preserve existing history state when adding scroll restoration state', async () => {
      const originalStateDescriptor = Object.getOwnPropertyDescriptor(history, 'state');
      mockHistory.getStack()[0]!.state = Object.assign(Object.create(null), {
        preserved: 'value',
        constructor: 'ignored',
        __proto__: 'ignored',
      });

      Object.defineProperty(history, 'state', {
        configurable: true,
        get: () => mockHistory.getStack()[mockHistory.getCurrentIndex()]?.state,
      });

      try {
        router = createRouter({
          routes: [
            { path: '/', component: () => null },
            { path: '/page', component: () => null },
          ],
          scrollRestoration: true,
        });

        await router.push('/page');
        const stack = mockHistory.getStack();
        const lastEntry = stack[stack.length - 1];
        expect(lastEntry.state).toMatchObject({
          preserved: 'value',
          __bqScrollKey: expect.any(String),
        });
        expect(
          Object.prototype.hasOwnProperty.call(
            lastEntry.state as Record<string, unknown>,
            '__proto__'
          )
        ).toBe(false);
        expect(
          Object.prototype.hasOwnProperty.call(
            lastEntry.state as Record<string, unknown>,
            'constructor'
          )
        ).toBe(false);
      } finally {
        if (originalStateDescriptor) {
          Object.defineProperty(history, 'state', originalStateDescriptor);
        } else {
          delete (history as History & { state?: unknown }).state;
        }
      }
    });

    it('should prune old scroll position entries after many navigations', async () => {
      const deleteSpy = spyOn(Map.prototype, 'delete');
      const routes: RouteDefinition[] = [{ path: '/', component: () => null }];

      for (let i = 0; i < 105; i++) {
        routes.push({ path: `/page-${i}`, component: () => null });
      }

      try {
        router = createRouter({
          routes,
          scrollRestoration: true,
        });

        for (let i = 0; i < 105; i++) {
          await router.push(`/page-${i}`);
        }

        expect(deleteSpy).toHaveBeenCalled();
        expect(deleteSpy).toHaveBeenCalledWith('0');
      } finally {
        deleteSpy.mockRestore();
      }
    });

    it('should generate unique scroll keys for push navigations within the same millisecond', async () => {
      const nowSpy = spyOn(Date, 'now').mockReturnValue(1234567890);

      try {
        router = createRouter({
          routes: [
            { path: '/', component: () => null },
            { path: '/page1', component: () => null },
            { path: '/page2', component: () => null },
          ],
          scrollRestoration: true,
        });

        await router.push('/page1');
        await router.push('/page2');

        const stack = mockHistory.getStack();
        const page1Key = (stack[1].state as Record<string, unknown>).__bqScrollKey;
        const page2Key = (stack[2].state as Record<string, unknown>).__bqScrollKey;

        expect(page1Key).not.toBe(page2Key);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it('should save scroll for the entry being left on popstate and restore the destination entry', async () => {
      const originalScrollX = Object.getOwnPropertyDescriptor(window, 'scrollX');
      const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
      const setScrollPosition = (x: number, y: number) => {
        Object.defineProperty(window, 'scrollX', { value: x, configurable: true });
        Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
      };

      try {
        router = createRouter({
          routes: [
            { path: '/', component: () => null },
            { path: '/page', component: () => null },
          ],
          scrollRestoration: true,
        });

        setScrollPosition(10, 20);
        await router.push('/page');

        setScrollPosition(30, 40);
        scrollToSpy.mockClear();
        router.back();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(scrollToSpy).toHaveBeenLastCalledWith(10, 20);

        scrollToSpy.mockClear();
        router.forward();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(scrollToSpy).toHaveBeenLastCalledWith(30, 40);
      } finally {
        if (originalScrollX) {
          Object.defineProperty(window, 'scrollX', originalScrollX);
        }
        if (originalScrollY) {
          Object.defineProperty(window, 'scrollY', originalScrollY);
        }
      }
    });

    it('should preserve the scroll restoration key when popstate navigation is canceled', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/page', component: () => null },
        ],
        scrollRestoration: true,
      });

      router.beforeEach((to) => {
        if (to.path === '/') return false;
      });

      await router.push('/page');
      const pageEntry = mockHistory.getStack()[mockHistory.getCurrentIndex()];
      expect(pageEntry.state).toHaveProperty('__bqScrollKey');

      router.back();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const restoredEntry = mockHistory.getStack()[mockHistory.getCurrentIndex()];
      expect(restoredEntry.url).toBe('/page');
      expect(restoredEntry.state).toHaveProperty('__bqScrollKey');
      expect(typeof (restoredEntry.state as Record<string, unknown>).__bqScrollKey).toBe('string');
    });
  });

  // ==========================================================================
  // <bq-link> Custom Element
  // ==========================================================================
  describe('bq-link custom element', () => {
    let mockHistory: ReturnType<typeof setupMockHistory>;
    let router: Router;

    it('should stay importable when HTMLElement is unavailable', async () => {
      const originalHTMLElementDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'HTMLElement'
      );
      const originalCustomElementsDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'customElements'
      );

      try {
        Object.defineProperty(globalThis, 'HTMLElement', {
          value: undefined,
          configurable: true,
        });
        Object.defineProperty(globalThis, 'customElements', {
          value: undefined,
          configurable: true,
        });

        const mod = await import(`../src/router/bq-link.ts?ssr-safe=${Date.now()}`);
        expect(mod.BqLinkElement).toBeDefined();
        expect(() => mod.registerBqLink()).not.toThrow();
      } finally {
        if (originalHTMLElementDescriptor) {
          Object.defineProperty(globalThis, 'HTMLElement', originalHTMLElementDescriptor);
        }
        if (originalCustomElementsDescriptor) {
          Object.defineProperty(globalThis, 'customElements', originalCustomElementsDescriptor);
        }
      }
    });

    beforeEach(() => {
      mockHistory = setupMockHistory();
      registerBqLink();
    });

    afterEach(() => {
      router?.destroy();
      mockHistory.restore();
    });

    it('should export BqLinkElement and registerBqLink', () => {
      expect(BqLinkElement).toBeDefined();
      expect(typeof registerBqLink).toBe('function');
    });

    it('should register the custom element idempotently', () => {
      registerBqLink();
      // Second call should not throw
      registerBqLink();
      expect(customElements.get('bq-link')).toBe(BqLinkElement);
    });

    it('should create a bq-link element with default attributes', () => {
      const el = document.createElement('bq-link') as BqLinkElement;
      document.body.appendChild(el);

      expect(el.to).toBe('/');
      expect(el.replace).toBe(false);
      expect(el.exact).toBe(false);
      expect(el.activeClass).toBe('active');

      el.remove();
    });

    it('should set and get the "to" attribute', () => {
      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      document.body.appendChild(el);

      expect(el.to).toBe('/about');
      expect(el.getAttribute('to')).toBe('/about');

      el.remove();
    });

    it('should set and get the "replace" attribute', () => {
      const el = document.createElement('bq-link') as BqLinkElement;
      document.body.appendChild(el);

      expect(el.replace).toBe(false);

      el.replace = true;
      expect(el.hasAttribute('replace')).toBe(true);

      el.replace = false;
      expect(el.hasAttribute('replace')).toBe(false);

      el.remove();
    });

    it('should set and get the "exact" attribute', () => {
      const el = document.createElement('bq-link') as BqLinkElement;
      document.body.appendChild(el);

      expect(el.exact).toBe(false);

      el.exact = true;
      expect(el.hasAttribute('exact')).toBe(true);

      el.exact = false;
      expect(el.hasAttribute('exact')).toBe(false);

      el.remove();
    });

    it('should set and get the "activeClass" attribute', () => {
      const el = document.createElement('bq-link') as BqLinkElement;
      document.body.appendChild(el);

      expect(el.activeClass).toBe('active');

      el.activeClass = 'selected';
      expect(el.getAttribute('active-class')).toBe('selected');
      expect(el.activeClass).toBe('selected');

      el.remove();
    });

    it('should set role="link" and tabindex on connect', () => {
      const el = document.createElement('bq-link') as BqLinkElement;
      document.body.appendChild(el);

      expect(el.getAttribute('role')).toBe('link');
      expect(el.getAttribute('tabindex')).toBe('0');

      el.remove();
    });

    it('should not override existing role attribute', () => {
      const el = document.createElement('bq-link') as BqLinkElement;
      el.setAttribute('role', 'button');
      document.body.appendChild(el);

      expect(el.getAttribute('role')).toBe('button');

      el.remove();
    });

    it('should not override existing tabindex', () => {
      const el = document.createElement('bq-link') as BqLinkElement;
      el.setAttribute('tabindex', '-1');
      document.body.appendChild(el);

      expect(el.getAttribute('tabindex')).toBe('-1');

      el.remove();
    });

    it('should apply active class when path matches', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/';
      document.body.appendChild(el);

      // Wait for effect to run
      await new Promise((r) => setTimeout(r, 10));

      expect(el.classList.contains('active')).toBe(true);
      expect(el.getAttribute('aria-current')).toBe('page');

      el.remove();
    });

    it('should remove active class when path does not match', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/nonexistent-path-xyz';
      el.exact = true;
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));

      expect(el.classList.contains('active')).toBe(false);
      expect(el.getAttribute('aria-current')).toBeNull();

      el.remove();
    });

    it('should apply custom active class', async () => {
      router = createRouter({
        routes: [{ path: '/', component: () => null }],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/';
      el.activeClass = 'selected';
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));

      expect(el.classList.contains('selected')).toBe(true);
      expect(el.classList.contains('active')).toBe(false);

      el.remove();
    });

    it('should apply each class token from a whitespace-separated active-class', async () => {
      router = createRouter({
        routes: [{ path: '/', component: () => null }],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/';
      el.activeClass = 'selected current';
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));

      expect(el.classList.contains('selected')).toBe(true);
      expect(el.classList.contains('current')).toBe(true);

      el.remove();
    });

    it('should remove previously tracked active classes when the active-class attribute changes', async () => {
      router = createRouter({
        routes: [{ path: '/', component: () => null }],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/';
      el.activeClass = 'selected current';
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));
      expect(el.classList.contains('selected')).toBe(true);
      expect(el.classList.contains('current')).toBe(true);

      el.activeClass = 'active-now';

      await new Promise((r) => setTimeout(r, 10));
      expect(el.classList.contains('selected')).toBe(false);
      expect(el.classList.contains('current')).toBe(false);
      expect(el.classList.contains('active-now')).toBe(true);

      el.remove();
    });

    it('should preserve user-authored active classes when the route does not match', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      await router.push('/about');

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/';
      el.classList.add('active');
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));

      expect(el.classList.contains('active')).toBe(true);
      expect(el.getAttribute('aria-current')).toBeNull();

      el.remove();
    });

    it('should restore user-authored active classes after disconnect or active-class changes', async () => {
      router = createRouter({
        routes: [{ path: '/', component: () => null }],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/';
      el.activeClass = 'active selected';
      el.classList.add('active');
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));
      expect(el.classList.contains('active')).toBe(true);
      expect(el.classList.contains('selected')).toBe(true);

      el.activeClass = 'current';

      await new Promise((r) => setTimeout(r, 10));
      expect(el.classList.contains('active')).toBe(true);
      expect(el.classList.contains('selected')).toBe(false);
      expect(el.classList.contains('current')).toBe(true);

      el.remove();

      expect(el.classList.contains('active')).toBe(true);
      expect(el.classList.contains('current')).toBe(false);
    });

    it('should match with path prefix by default (not exact)', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
          { path: '/about/team', component: () => null },
        ],
      });

      await router.push('/about/team');

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));

      // '/about/team' starts with '/about/' so it matches
      expect(el.classList.contains('active')).toBe(true);

      el.remove();
    });

    it('should not match partial path segments in non-exact mode', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/user', component: () => null },
          { path: '/user-profile', component: () => null },
        ],
      });

      await router.push('/user-profile');

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/user';
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));

      // '/user-profile' should NOT match '/user' (different segment)
      expect(el.classList.contains('active')).toBe(false);

      el.remove();
    });

    it('should not match prefix when exact is set', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      await router.push('/about');

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/';
      el.exact = true;
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));

      // '/about' !== '/' with exact
      expect(el.classList.contains('active')).toBe(false);

      el.remove();
    });

    it('should navigate on click', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      document.body.appendChild(el);

      const event = new MouseEvent('click', { button: 0, bubbles: true });
      el.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 50));

      expect(currentRoute.value.path).toBe('/about');

      el.remove();
    });

    it('should navigate on Enter keypress', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      document.body.appendChild(el);

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      el.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 50));

      expect(currentRoute.value.path).toBe('/about');

      el.remove();
    });

    it('should not navigate on Space keypress', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
          { path: '/contact', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/contact';
      document.body.appendChild(el);

      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
      el.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 50));

      expect(currentRoute.value.path).toBe('/');

      el.remove();
    });

    it('should not navigate on non-left click', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      document.body.appendChild(el);

      // Middle-click (button 1)
      const event = new MouseEvent('click', { button: 1, bubbles: true });
      el.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 50));

      expect(currentRoute.value.path).toBe('/');

      el.remove();
    });

    it('should ignore ctrl+click so modified clicks are not swallowed', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      document.body.appendChild(el);

      const event = new MouseEvent('click', {
        button: 0,
        ctrlKey: true,
        bubbles: true,
      });
      el.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 50));

      expect(currentRoute.value.path).toBe('/');
      expect(event.defaultPrevented).toBe(false);

      el.remove();
    });

    it('should ignore meta+click so modified clicks are not swallowed', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      document.body.appendChild(el);

      const event = new MouseEvent('click', {
        button: 0,
        metaKey: true,
        bubbles: true,
      });
      el.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 50));

      expect(currentRoute.value.path).toBe('/');
      expect(event.defaultPrevented).toBe(false);

      el.remove();
    });

    it('should ignore clicks that were already prevented', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      document.body.appendChild(el);

      const capturingPreventListener = (event: Event) => event.preventDefault();
      document.body.addEventListener('click', capturingPreventListener, { capture: true });

      const event = new MouseEvent('click', { button: 0, bubbles: true, cancelable: true });
      el.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 50));

      expect(currentRoute.value.path).toBe('/');
      expect(event.defaultPrevented).toBe(true);

      document.body.removeEventListener('click', capturingPreventListener, { capture: true });
      el.remove();
    });

    it('should use replace navigation when replace attribute is set', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      el.replace = true;
      document.body.appendChild(el);

      const initialLength = mockHistory.getStack().length;

      const event = new MouseEvent('click', { button: 0, bubbles: true });
      el.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 50));

      expect(currentRoute.value.path).toBe('/about');
      // Replace should not increase history length
      expect(mockHistory.getStack().length).toBe(initialLength);

      el.remove();
    });

    it('should cleanup effect on disconnect', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/';
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));

      expect(el.classList.contains('active')).toBe(true);

      // Disconnect
      el.remove();

      // Should not throw after disconnect
      await router.push('/about');
      await new Promise((r) => setTimeout(r, 10));
    });

    it('should update active class when "to" attribute changes', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
          { path: '/contact', component: () => null },
        ],
      });

      await router.push('/about');

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      el.exact = true;
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));
      expect(el.classList.contains('active')).toBe(true);

      // Change target path
      el.to = '/contact';

      await new Promise((r) => setTimeout(r, 10));
      expect(el.classList.contains('active')).toBe(false);

      el.remove();
    });

    it('should handle empty "to" attribute gracefully', async () => {
      const el = document.createElement('bq-link') as BqLinkElement;
      el.setAttribute('to', '');
      document.body.appendChild(el);

      // Should not throw (no router but we catch errors)
      const event = new MouseEvent('click', { button: 0, bubbles: true });
      el.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 50));

      el.remove();
    });

    it('should normalize empty "to" attributes to "/" without matching every route', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      await router.push('/about');

      const el = document.createElement('bq-link') as BqLinkElement;
      el.setAttribute('to', '');
      document.body.appendChild(el);

      await new Promise((r) => setTimeout(r, 10));

      expect(el.to).toBe('/');
      expect(el.classList.contains('active')).toBe(false);

      el.remove();
    });

    it('should not navigate on non-Enter key', async () => {
      router = createRouter({
        routes: [
          { path: '/', component: () => null },
          { path: '/about', component: () => null },
        ],
      });

      const el = document.createElement('bq-link') as BqLinkElement;
      el.to = '/about';
      document.body.appendChild(el);

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      el.dispatchEvent(event);

      await new Promise((r) => setTimeout(r, 50));

      expect(currentRoute.value.path).toBe('/');

      el.remove();
    });
  });
});
