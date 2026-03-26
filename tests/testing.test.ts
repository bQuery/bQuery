/**
 * Tests for the bQuery testing utilities module.
 *
 * @module bquery/testing
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { signal } from '../src/reactive/core';
import { effect } from '../src/reactive/effect';
import { batch } from '../src/reactive/batch';
import { component } from '../src/component/index';
import {
  renderComponent,
  flushEffects,
  mockSignal,
  mockRouter,
  fireEvent,
  waitFor,
} from '../src/testing/index';
import type {
  MockRouter,
} from '../src/testing/types';

// ============================================================================
// renderComponent
// ============================================================================

describe('renderComponent', () => {
  // Register test components
  const TEST_TAG = 'test-render-comp';
  const TEST_TAG_PROPS = 'test-render-props';
  const TEST_TAG_SLOTS = 'test-render-slots';
  const TEST_TAG_NOSHADOW = 'test-render-noshadow';

  beforeEach(() => {
    // Register components if not already registered
    if (!customElements.get(TEST_TAG)) {
      component(TEST_TAG, {
        render() {
          return '<p>Hello</p>';
        },
      });
    }
    if (!customElements.get(TEST_TAG_PROPS)) {
      component<{ name: string }>(TEST_TAG_PROPS, {
        props: {
          name: { type: String, default: 'World' },
        },
        render({ props }) {
          return `<p>Hello ${props.name}</p>`;
        },
      });
    }
    if (!customElements.get(TEST_TAG_SLOTS)) {
      component(TEST_TAG_SLOTS, {
        render() {
          return '<slot></slot><slot name="header"></slot>';
        },
      });
    }
    if (!customElements.get(TEST_TAG_NOSHADOW)) {
      component(TEST_TAG_NOSHADOW, {
        shadow: false,
        render() {
          return '<p>No shadow</p>';
        },
      });
    }
  });

  it('should mount a component and return el and unmount', () => {
    const { el, unmount } = renderComponent(TEST_TAG);
    expect(el).toBeDefined();
    expect(el.tagName.toLowerCase()).toBe(TEST_TAG);
    expect(el.parentNode).toBe(document.body);
    unmount();
    expect(el.parentNode).toBeNull();
  });

  it('should set props as attributes', () => {
    const { el, unmount } = renderComponent(TEST_TAG_PROPS, {
      props: { name: 'bQuery' },
    });
    expect(el.getAttribute('name')).toBe('bQuery');
    unmount();
  });

  it('should skip null/undefined prop values', () => {
    const { el, unmount } = renderComponent(TEST_TAG_PROPS, {
      props: { name: null as unknown as string },
    });
    expect(el.hasAttribute('name')).toBe(false);
    unmount();
  });

  it('should inject default slot content as string', () => {
    const { el, unmount } = renderComponent(TEST_TAG_SLOTS, {
      slots: '<span>Default Content</span>',
    });
    expect(el.innerHTML).toContain('Default Content');
    unmount();
  });

  it('should inject named slots via object', () => {
    const { el, unmount } = renderComponent(TEST_TAG_SLOTS, {
      slots: {
        default: '<span>Body</span>',
        header: '<h2>Title</h2>',
      },
    });
    expect(el.innerHTML).toContain('Body');
    expect(el.innerHTML).toContain('Title');
    expect(el.innerHTML).toContain('slot="header"');
    unmount();
  });

  it('should mount into a custom container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { el, unmount } = renderComponent(TEST_TAG, {
      container,
    });
    expect(el.parentNode).toBe(container);
    unmount();
    container.remove();
  });

  it('should throw for invalid tag name (no hyphen)', () => {
    expect(() => renderComponent('noHyphen')).toThrow('not a valid custom element');
  });

  it('should throw for empty tag name', () => {
    expect(() => renderComponent('')).toThrow('not a valid custom element');
  });

  it('should work with no options', () => {
    const { el, unmount } = renderComponent(TEST_TAG);
    expect(el).toBeDefined();
    unmount();
  });

  it('unmount should be idempotent', () => {
    const { unmount } = renderComponent(TEST_TAG);
    unmount();
    // Second call should not throw
    unmount();
  });
});

// ============================================================================
// flushEffects
// ============================================================================

describe('flushEffects', () => {
  it('should flush pending batch effects', () => {
    const count = signal(0);
    let observed = -1;
    const cleanup = effect(() => {
      observed = count.value;
    });
    expect(observed).toBe(0);

    batch(() => {
      count.value = 42;
    });
    // After batch, effects are flushed synchronously anyway,
    // but flushEffects ensures it
    flushEffects();
    expect(observed).toBe(42);
    cleanup();
    count.dispose();
  });

  it('should be safe to call with no pending effects', () => {
    // Should not throw
    flushEffects();
    flushEffects();
  });

  it('should handle nested signal updates', () => {
    const a = signal(1);
    const b = signal(2);
    let sum = 0;
    const cleanup = effect(() => {
      sum = a.value + b.value;
    });
    expect(sum).toBe(3);

    batch(() => {
      a.value = 10;
      b.value = 20;
    });
    flushEffects();
    expect(sum).toBe(30);
    cleanup();
    a.dispose();
    b.dispose();
  });
});

// ============================================================================
// mockSignal
// ============================================================================

describe('mockSignal', () => {
  it('should create a signal with the given initial value', () => {
    const s = mockSignal(42);
    expect(s.value).toBe(42);
    s.dispose();
  });

  it('should track the initial value', () => {
    const s = mockSignal('hello');
    expect(s.initialValue).toBe('hello');
    s.value = 'world';
    expect(s.initialValue).toBe('hello');
    s.dispose();
  });

  it('should have an immutable initialValue property', () => {
    const s = mockSignal(42);
    // initialValue is defined with writable: false — in strict mode
    // (which TypeScript/Bun uses), assigning to it throws a TypeError
    try {
      (s as unknown as Record<string, unknown>).initialValue = 999;
    } catch {
      // Ignore runtime errors - the invariant we care about is the value staying unchanged.
    }
    // Whether it throws or silently ignores, the value must remain unchanged
    expect(s.initialValue).toBe(42);
    s.dispose();
  });

  it('should have a set() method', () => {
    const s = mockSignal(0);
    s.set(99);
    expect(s.value).toBe(99);
    s.dispose();
  });

  it('should have a reset() method', () => {
    const s = mockSignal(5);
    s.set(100);
    expect(s.value).toBe(100);
    s.reset();
    expect(s.value).toBe(5);
    s.dispose();
  });

  it('should work with effects', () => {
    const s = mockSignal(0);
    let observed = -1;
    const cleanup = effect(() => {
      observed = s.value;
    });
    expect(observed).toBe(0);
    s.set(10);
    expect(observed).toBe(10);
    s.reset();
    expect(observed).toBe(0);
    cleanup();
    s.dispose();
  });

  it('should work with objects', () => {
    const initial = { x: 1, y: 2 };
    const s = mockSignal(initial);
    expect(s.value).toEqual({ x: 1, y: 2 });
    s.set({ x: 10, y: 20 });
    expect(s.value).toEqual({ x: 10, y: 20 });
    s.reset();
    // Reset restores to original reference
    expect(s.value).toBe(initial);
    s.dispose();
  });

  it('should work with null initial value', () => {
    const s = mockSignal<string | null>(null);
    expect(s.value).toBeNull();
    expect(s.initialValue).toBeNull();
    s.set('hello');
    expect(s.value).toBe('hello');
    s.reset();
    expect(s.value).toBeNull();
    s.dispose();
  });

  it('should support peek()', () => {
    const s = mockSignal(42);
    expect(s.peek()).toBe(42);
    s.dispose();
  });

  it('should support update()', () => {
    const s = mockSignal(10);
    s.update((v) => v * 2);
    expect(s.value).toBe(20);
    s.dispose();
  });
});

// ============================================================================
// mockRouter
// ============================================================================

describe('mockRouter', () => {
  let router: MockRouter;

  afterEach(() => {
    router?.destroy();
  });

  it('should create a mock router with default options', () => {
    router = mockRouter();
    expect(router.currentRoute.value.path).toBe('/');
    expect(router.routes).toHaveLength(1);
  });

  it('should start at the specified initial path', () => {
    router = mockRouter({
      routes: [{ path: '/' }, { path: '/about' }],
      initialPath: '/about',
    });
    expect(router.currentRoute.value.path).toBe('/about');
  });

  it('should update route on push', () => {
    router = mockRouter({
      routes: [{ path: '/' }, { path: '/about' }],
    });
    router.push('/about');
    expect(router.currentRoute.value.path).toBe('/about');
  });

  it('should update route on replace', () => {
    router = mockRouter({
      routes: [{ path: '/' }, { path: '/about' }],
    });
    router.replace('/about');
    expect(router.currentRoute.value.path).toBe('/about');
  });

  it('should extract params from route', () => {
    router = mockRouter({
      routes: [{ path: '/user/:id' }],
    });
    router.push('/user/42');
    expect(router.currentRoute.value.params).toEqual({ id: '42' });
  });

  it('should handle regex constrained params', () => {
    router = mockRouter({
      routes: [{ path: '/user/:id(\\d+)' }],
    });
    router.push('/user/123');
    expect(router.currentRoute.value.params).toEqual({ id: '123' });
    expect(router.currentRoute.value.matched?.path).toBe('/user/:id(\\d+)');
  });

  it('should parse query strings', () => {
    router = mockRouter({
      routes: [{ path: '/' }],
    });
    router.push('/?foo=bar&baz=qux');
    expect(router.currentRoute.value.query).toEqual({ foo: 'bar', baz: 'qux' });
  });

  it('should handle repeated query params as arrays', () => {
    router = mockRouter({
      routes: [{ path: '/' }],
    });
    router.push('/?tag=a&tag=b');
    expect(router.currentRoute.value.query).toEqual({ tag: ['a', 'b'] });
  });

  it('should parse hash fragments', () => {
    router = mockRouter({
      routes: [{ path: '/' }],
    });
    router.push('/#section1');
    expect(router.currentRoute.value.hash).toBe('section1');
  });

  it('should handle combined path + query + hash', () => {
    router = mockRouter({
      routes: [{ path: '/page' }],
    });
    router.push('/page?q=test#top');
    const route = router.currentRoute.value;
    expect(route.path).toBe('/page');
    expect(route.query).toEqual({ q: 'test' });
    expect(route.hash).toBe('top');
  });

  it('should strip base from paths', () => {
    router = mockRouter({
      routes: [{ path: '/home' }],
      base: '/app',
    });
    router.push('/app/home');
    expect(router.currentRoute.value.path).toBe('/home');
  });

  it('should set matched to null for unknown routes', () => {
    router = mockRouter({
      routes: [{ path: '/' }],
    });
    router.push('/unknown');
    expect(router.currentRoute.value.matched).toBeNull();
  });

  it('should handle wildcard routes', () => {
    router = mockRouter({
      routes: [{ path: '*' }],
    });
    router.push('/any/path/here');
    expect(router.currentRoute.value.matched?.path).toBe('*');
  });

  it('should handle catch-all param routes', () => {
    router = mockRouter({
      routes: [{ path: '/files/:path*' }],
    });
    router.push('/files/a/b/c');
    expect(router.currentRoute.value.params.path).toBe('a/b/c');
  });

  it('should be reactive (effects trigger on push)', () => {
    router = mockRouter({
      routes: [{ path: '/' }, { path: '/about' }],
    });
    let currentPath = '';
    const cleanup = effect(() => {
      currentPath = router.currentRoute.value.path;
    });
    expect(currentPath).toBe('/');
    router.push('/about');
    expect(currentPath).toBe('/about');
    cleanup();
  });

  it('destroy should clean up the signal', () => {
    router = mockRouter();
    router.destroy();
    // After destroy, signal should be disposed (no error, just no subscribers)
  });
});

// ============================================================================
// fireEvent
// ============================================================================

describe('fireEvent', () => {
  it('should dispatch a click event', () => {
    const el = document.createElement('button');
    let clicked = false;
    el.addEventListener('click', () => {
      clicked = true;
    });
    document.body.appendChild(el);
    fireEvent(el, 'click');
    expect(clicked).toBe(true);
    el.remove();
  });

  it('should dispatch a custom event with detail', () => {
    const el = document.createElement('div');
    let receivedDetail: unknown = null;
    el.addEventListener('my-event', ((e: CustomEvent) => {
      receivedDetail = e.detail;
    }) as EventListener);
    document.body.appendChild(el);
    fireEvent(el, 'my-event', { detail: { foo: 'bar' } });
    expect(receivedDetail).toEqual({ foo: 'bar' });
    el.remove();
  });

  it('should return true if event was not cancelled', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const result = fireEvent(el, 'test');
    expect(result).toBe(true);
    el.remove();
  });

  it('should return false if event was cancelled', () => {
    const el = document.createElement('div');
    el.addEventListener('test', (e) => e.preventDefault());
    document.body.appendChild(el);
    const result = fireEvent(el, 'test');
    expect(result).toBe(false);
    el.remove();
  });

  it('should flush effects after dispatch', () => {
    const count = signal(0);
    let observed = 0;
    const cleanup = effect(() => {
      observed = count.value;
    });

    const el = document.createElement('button');
    el.addEventListener('click', () => {
      count.value = 99;
    });
    document.body.appendChild(el);
    fireEvent(el, 'click');
    expect(observed).toBe(99);
    el.remove();
    cleanup();
    count.dispose();
  });

  it('should throw for null element', () => {
    expect(() => fireEvent(null as unknown as Element, 'click')).toThrow(
      'requires a valid element'
    );
  });

  it('should throw for empty event name', () => {
    const el = document.createElement('div');
    expect(() => fireEvent(el, '')).toThrow('requires an event name');
  });

  it('should support custom bubbles/cancelable/composed options', () => {
    const el = document.createElement('div');
    let eventBubbles = true;
    el.addEventListener(
      'test',
      (e) => {
        eventBubbles = e.bubbles;
      },
    );
    document.body.appendChild(el);
    fireEvent(el, 'test', { bubbles: false });
    expect(eventBubbles).toBe(false);
    el.remove();
  });

  it('should default to bubbles, cancelable, composed', () => {
    const el = document.createElement('div');
    let event: Event | null = null;
    el.addEventListener('test', (e) => {
      event = e;
    });
    document.body.appendChild(el);
    fireEvent(el, 'test');
    expect(event!.bubbles).toBe(true);
    expect(event!.cancelable).toBe(true);
    el.remove();
  });
});

// ============================================================================
// waitFor
// ============================================================================

describe('waitFor', () => {
  it('should resolve immediately if predicate is true', async () => {
    await waitFor(() => true);
  });

  it('should wait until predicate becomes true', async () => {
    let ready = false;
    setTimeout(() => {
      ready = true;
    }, 50);
    await waitFor(() => ready, { timeout: 1000 });
    expect(ready).toBe(true);
  });

  it('should timeout if predicate never returns true', async () => {
    try {
      await waitFor(() => false, { timeout: 50, interval: 10 });
      expect(true).toBe(false); // should not reach here
    } catch (e: unknown) {
      expect((e as Error).message).toContain('timed out');
    }
  });

  it('should handle async predicates', async () => {
    let counter = 0;
    await waitFor(async () => {
      counter++;
      return counter >= 3;
    }, { interval: 5 });
    expect(counter).toBeGreaterThanOrEqual(3);
  });

  it('should handle predicates that throw (treats as not-met)', async () => {
    let callCount = 0;
    await waitFor(() => {
      callCount++;
      if (callCount < 3) throw new Error('not ready');
      return true;
    }, { interval: 5 });
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it('should throw for non-function predicate', async () => {
    try {
      await waitFor('not a function' as unknown as () => boolean);
      expect(true).toBe(false);
    } catch (e: unknown) {
      expect((e as Error).message).toContain('requires a predicate function');
    }
  });

  it('should use default timeout and interval', async () => {
    // Just test that the defaults work without explicit options
    await waitFor(() => true);
  });

  it('should work with signal-based predicates', async () => {
    const ready = signal(false);
    setTimeout(() => {
      ready.value = true;
    }, 30);
    await waitFor(() => ready.peek(), { timeout: 500 });
    expect(ready.value).toBe(true);
    ready.dispose();
  });
});

// ============================================================================
// Module exports
// ============================================================================

describe('testing module exports', () => {
  it('exports all public functions from barrel', async () => {
    const barrel = await import('../src/testing/index');
    expect(typeof barrel.renderComponent).toBe('function');
    expect(typeof barrel.flushEffects).toBe('function');
    expect(typeof barrel.mockSignal).toBe('function');
    expect(typeof barrel.mockRouter).toBe('function');
    expect(typeof barrel.fireEvent).toBe('function');
    expect(typeof barrel.waitFor).toBe('function');
  });

  it('is re-exported from main index', async () => {
    const main = await import('../src/index');
    expect(typeof main.renderComponent).toBe('function');
    expect(typeof main.flushEffects).toBe('function');
    expect(typeof main.mockSignal).toBe('function');
    expect(typeof main.mockRouter).toBe('function');
    expect(typeof main.fireEvent).toBe('function');
    expect(typeof main.waitFor).toBe('function');
  });

  it('is exported from full bundle', async () => {
    const full = await import('../src/full');
    expect(typeof full.renderComponent).toBe('function');
    expect(typeof full.flushEffects).toBe('function');
    expect(typeof full.mockSignal).toBe('function');
    expect(typeof full.mockRouter).toBe('function');
    expect(typeof full.fireEvent).toBe('function');
    expect(typeof full.waitFor).toBe('function');
  });
});
