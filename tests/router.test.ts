/**
 * Router module tests
 *
 * These tests use a mocked History API to test router functionality
 * in the happy-dom environment.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import {
  back,
  createRouter,
  currentRoute,
  forward,
  interceptLinks,
  isActive,
  isActiveSignal,
  link,
  navigate,
  resolve,
  type RouteDefinition,
  type Router,
} from '../src/router/index';

// ============================================================================
// Test Setup - Mock History API and Location
// ============================================================================

const TEST_ORIGIN = 'http://localhost';

/**
 * Helper to setup mocked window.location and history for router tests.
 */
const setupMockHistory = () => {
  const historyStack: { state: unknown; url: string }[] = [{ state: {}, url: '/' }];
  let currentIndex = 0;

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

  // Store original location
  const originalLocation = window.location;

  // Set initial location
  Object.defineProperty(window, 'location', {
    value: createMockLocation('/'),
    writable: true,
    configurable: true,
  });

  const updateLocation = (url: string) => {
    Object.defineProperty(window, 'location', {
      value: createMockLocation(url),
      writable: true,
      configurable: true,
    });
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

  return {
    restore: () => {
      pushStateSpy.mockRestore();
      replaceStateSpy.mockRestore();
      backSpy.mockRestore();
      forwardSpy.mockRestore();
      goSpy.mockRestore();
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    },
    getStack: () => historyStack,
    getCurrentIndex: () => currentIndex,
    updateLocation,
  };
};

// ============================================================================
// Module Export Tests
// ============================================================================

describe('Router', () => {
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

      let _guardCalled = false;
      router.beforeEach(() => {
        _guardCalled = true;
      });

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

    it('should flatten nested routes with base path', () => {
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
      expect(router.routes[1].path).toBe('/app/parent/child');
    });
  });
});
