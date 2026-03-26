/**
 * Testing utilities for bQuery.js.
 *
 * Provides helpers for mounting components, controlling signals, mocking
 * the router, dispatching events, and asserting async conditions — all
 * designed for use with `bun:test` and happy-dom.
 *
 * @module bquery/testing
 */

import { Signal, signal } from '../reactive/core';
import { batch } from '../reactive/batch';
import type {
  FireEventOptions,
  MockRouteDefinition,
  MockRouter,
  MockRouterOptions,
  MockSignal,
  RenderComponentOptions,
  RenderResult,
  Route,
  WaitForOptions,
} from './types';

// ============================================================================
// renderComponent
// ============================================================================

const isWordChar = (char: string | undefined): boolean =>
  char !== undefined &&
  ((char >= 'a' && char <= 'z') ||
    (char >= 'A' && char <= 'Z') ||
    (char >= '0' && char <= '9') ||
    char === '_');

const readRouteConstraint = (
  pattern: string,
  startIndex: number
): { constraint: string; endIndex: number } | null => {
  let depth = 1;
  let constraint = '';
  let i = startIndex + 1;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '\\' && i + 1 < pattern.length) {
      constraint += char + pattern[i + 1];
      i += 2;
      continue;
    }

    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        return { constraint, endIndex: i + 1 };
      }
    }

    constraint += char;
    i++;
  }

  return null;
};

/**
 * Mounts a custom element by tag name for testing and returns a handle
 * to interact with it.
 *
 * The element is created, configured with the given props and slots,
 * and appended to the container (defaults to `document.body`). Call
 * `unmount()` to remove the element and trigger its `disconnectedCallback`.
 *
 * @param tagName - The custom element tag name (must already be registered)
 * @param options - Props, slots, and container configuration
 * @returns A {@link RenderResult} with the element and an unmount function
 * @throws {Error} If the tag name is not a valid custom element name
 *
 * @example
 * ```ts
 * import { renderComponent } from '@bquery/bquery/testing';
 *
 * const { el, unmount } = renderComponent('my-counter', {
 *   props: { start: '5' },
 * });
 * expect(el.shadowRoot?.textContent).toContain('5');
 * unmount();
 * ```
 */
export function renderComponent(
  tagName: string,
  options: RenderComponentOptions = {}
): RenderResult {
  if (!tagName || !tagName.includes('-')) {
    throw new Error(
      `bQuery testing: "${tagName}" is not a valid custom element tag name (must contain a hyphen)`
    );
  }

  const { props, slots, container = document.body } = options;

  const el = document.createElement(tagName);

  // Set attributes (props) before connecting
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined) continue;
      el.setAttribute(key, String(value));
    }
  }

  // Inject slot content before connecting so the component can discover it
  if (slots) {
    if (typeof slots === 'string') {
      el.innerHTML = slots;
    } else {
      const parts: string[] = [];
      for (const [slotName, html] of Object.entries(slots)) {
        if (slotName === 'default') {
          parts.push(html);
        } else {
          parts.push(`<div slot="${slotName}">${html}</div>`);
        }
      }
      el.innerHTML = parts.join('');
    }
  }

  // Connect — triggers connectedCallback
  container.appendChild(el);

  const unmount = (): void => {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  };

  return { el, unmount };
}

// ============================================================================
// flushEffects
// ============================================================================

/**
 * Synchronously flushes any pending reactive effects.
 *
 * In bQuery's reactive system, effects outside of a batch are executed
 * synchronously. This helper exists primarily for clarity and for
 * flushing effects that may have been deferred inside a batch.
 *
 * Internally it performs a no-op batch to trigger the flush of any
 * pending observers that were queued during a prior `batch()` call.
 *
 * @example
 * ```ts
 * import { signal, batch } from '@bquery/bquery/reactive';
 * import { flushEffects } from '@bquery/bquery/testing';
 *
 * const count = signal(0);
 * let observed = 0;
 * effect(() => { observed = count.value; });
 *
 * batch(() => { count.value = 42; });
 * flushEffects();
 * expect(observed).toBe(42);
 * ```
 */
export function flushEffects(): void {
  // A no-op batch triggers endBatch which flushes any pending observers.
  // Since bQuery's effects are synchronous outside of batches, this is
  // mainly useful after manual batch calls or micro-task boundaries.
  batch(() => {
    /* intentionally empty — triggers pending observer flush */
  });
}

// ============================================================================
// mockSignal
// ============================================================================

/**
 * Creates a controllable signal for tests with `set()` and `reset()` helpers.
 *
 * This is a thin wrapper around `signal()` that records the initial value
 * and adds explicit `set()` / `reset()` methods for clearer test intent.
 *
 * @template T - The type of the signal value
 * @param initialValue - The initial value
 * @returns A {@link MockSignal} instance
 *
 * @example
 * ```ts
 * import { mockSignal } from '@bquery/bquery/testing';
 *
 * const count = mockSignal(0);
 * count.set(5);
 * expect(count.value).toBe(5);
 * count.reset();
 * expect(count.value).toBe(0);
 * ```
 */
export function mockSignal<T>(initialValue: T): MockSignal<T> {
  const s = signal(initialValue) as Signal<T> & {
    set: (value: T) => void;
    reset: () => void;
    initialValue: T;
  };

  Object.defineProperty(s, 'initialValue', {
    value: initialValue,
    writable: false,
    enumerable: true,
  });

  s.set = function (value: T): void {
    s.value = value;
  };

  s.reset = function (): void {
    s.value = initialValue;
  };

  return s as MockSignal<T>;
}

// ============================================================================
// mockRouter
// ============================================================================

/**
 * Parses a path string into the route's `path`, `query`, and `hash` parts.
 * @internal
 */
function parsePath(fullPath: string, base: string): { path: string; query: Record<string, string | string[]>; hash: string } {
  let working = fullPath;

  // Strip base prefix
  if (base && working.startsWith(base)) {
    working = working.slice(base.length) || '/';
  }

  // Extract hash
  let hash = '';
  const hashIdx = working.indexOf('#');
  if (hashIdx >= 0) {
    hash = working.slice(hashIdx + 1);
    working = working.slice(0, hashIdx);
  }

  // Extract query string
  const query: Record<string, string | string[]> = {};
  const qIdx = working.indexOf('?');
  if (qIdx >= 0) {
    const qs = working.slice(qIdx + 1);
    working = working.slice(0, qIdx);
    for (const pair of qs.split('&')) {
      const eqIdx = pair.indexOf('=');
      const key = eqIdx >= 0 ? decodeURIComponent(pair.slice(0, eqIdx)) : decodeURIComponent(pair);
      const val = eqIdx >= 0 ? decodeURIComponent(pair.slice(eqIdx + 1)) : '';
      const existing = query[key];
      if (existing !== undefined) {
        if (Array.isArray(existing)) {
          existing.push(val);
        } else {
          query[key] = [existing, val];
        }
      } else {
        query[key] = val;
      }
    }
  }

  return { path: working || '/', query, hash };
}

/**
 * Matches a path against a route definition, extracting params.
 * @internal
 */
function matchRoute(
  path: string,
  routes: MockRouteDefinition[]
): { matched: MockRouteDefinition | null; params: Record<string, string> } {
  for (const route of routes) {
    const { regex, paramNames } = buildRouteRegex(route.path);
    const match = path.match(regex);
    if (match) {
      const params: Record<string, string> = {};
      for (let i = 0; i < paramNames.length; i++) {
        params[paramNames[i]] = match[i + 1] ?? '';
      }
      return { matched: route, params };
    }
  }
  return { matched: null, params: {} };
}

/**
 * Builds a regex from a route path pattern.
 * @internal
 */
function buildRouteRegex(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];

  if (pattern === '*') {
    return { regex: /^.*$/, paramNames: [] };
  }

  let regexStr = '';

  for (let i = 0; i < pattern.length; ) {
    if (pattern[i] !== ':' || !isWordChar(pattern[i + 1])) {
      regexStr += pattern[i];
      i++;
      continue;
    }

    let nameEnd = i + 2;
    while (nameEnd < pattern.length && isWordChar(pattern[nameEnd])) {
      nameEnd++;
    }

    const name = pattern.slice(i + 1, nameEnd);
    paramNames.push(name);

    if (pattern[nameEnd] === '(') {
      const parsedConstraint = readRouteConstraint(pattern, nameEnd);
      if (parsedConstraint) {
        regexStr += `(${parsedConstraint.constraint})`;
        i = parsedConstraint.endIndex;
        continue;
      }
    }

    if (pattern[nameEnd] === '*') {
      regexStr += '(.*)';
      i = nameEnd + 1;
      continue;
    }

    regexStr += '([^/]+)';
    i = nameEnd;
  }

  return { regex: new RegExp(`^${regexStr}$`), paramNames };
}

/**
 * Creates a lightweight mock router for testing that does not interact
 * with the browser History API.
 *
 * The mock router provides a reactive `currentRoute` signal that updates
 * when `push()` or `replace()` is called, making it ideal for testing
 * components or logic that depend on route state.
 *
 * @param options - Mock router configuration
 * @returns A {@link MockRouter} instance
 *
 * @example
 * ```ts
 * import { mockRouter } from '@bquery/bquery/testing';
 *
 * const router = mockRouter({
 *   routes: [
 *     { path: '/', component: () => null },
 *     { path: '/user/:id', component: () => null },
 *   ],
 *   initialPath: '/',
 * });
 *
 * router.push('/user/42');
 * expect(router.currentRoute.value.params.id).toBe('42');
 * router.destroy();
 * ```
 */
export function mockRouter(options: MockRouterOptions = {}): MockRouter {
  const routes = options.routes ?? [{ path: '*', component: () => null }];
  const base = options.base ?? '';
  const initialPath = options.initialPath ?? '/';

  const resolveRoute = (fullPath: string): Route => {
    const { path, query, hash } = parsePath(fullPath, base);
    const { matched, params } = matchRoute(path, routes);
    return { path, params, query, matched, hash };
  };

  const routeSignal = signal<Route>(resolveRoute(initialPath));

  return {
    push(path: string): void {
      routeSignal.value = resolveRoute(path);
    },
    replace(path: string): void {
      routeSignal.value = resolveRoute(path);
    },
    get currentRoute(): Signal<Route> {
      return routeSignal;
    },
    get routes(): MockRouteDefinition[] {
      return routes;
    },
    destroy(): void {
      routeSignal.dispose();
    },
  };
}

// ============================================================================
// fireEvent
// ============================================================================

/**
 * Dispatches a synthetic event on an element and flushes pending effects.
 *
 * By default the event bubbles, is cancelable, and is composed (crosses
 * shadow DOM boundaries). Pass a `detail` option to create a `CustomEvent`.
 *
 * @param el - The target element
 * @param eventName - The event type (e.g. 'click', 'input', 'my-event')
 * @param options - Event configuration
 * @returns `true` if the event was not cancelled
 *
 * @example
 * ```ts
 * import { fireEvent } from '@bquery/bquery/testing';
 *
 * const button = document.createElement('button');
 * let clicked = false;
 * button.addEventListener('click', () => { clicked = true; });
 * fireEvent(button, 'click');
 * expect(clicked).toBe(true);
 * ```
 */
export function fireEvent(
  el: Element,
  eventName: string,
  options: FireEventOptions = {}
): boolean {
  if (!el) {
    throw new Error('bQuery testing: fireEvent requires a valid element');
  }
  if (!eventName) {
    throw new Error('bQuery testing: fireEvent requires an event name');
  }

  const {
    bubbles = true,
    cancelable = true,
    composed = true,
    detail,
  } = options;

  let event: Event;
  if (detail !== undefined) {
    event = new CustomEvent(eventName, { bubbles, cancelable, composed, detail });
  } else {
    event = new Event(eventName, { bubbles, cancelable, composed });
  }

  const result = el.dispatchEvent(event);

  // Flush any effects triggered by event handlers
  flushEffects();

  return result;
}

// ============================================================================
// waitFor
// ============================================================================

/**
 * Waits for a predicate to return `true`, polling at a configurable interval.
 *
 * Useful for asserting conditions that depend on asynchronous operations,
 * timers, or deferred reactive updates.
 *
 * @param predicate - A function that returns `true` when the condition is met
 * @param options - Timeout and interval configuration
 * @returns A promise that resolves when the predicate returns `true`
 * @throws {Error} If the predicate does not return `true` within the timeout
 *
 * @example
 * ```ts
 * import { waitFor } from '@bquery/bquery/testing';
 *
 * await waitFor(() => document.querySelector('.loaded') !== null, {
 *   timeout: 2000,
 * });
 * ```
 */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  options: WaitForOptions = {}
): Promise<void> {
  if (typeof predicate !== 'function') {
    throw new Error('bQuery testing: waitFor requires a predicate function');
  }

  const { timeout = 1000, interval = 10 } = options;
  const start = Date.now();

  while (true) {
    try {
      const result = await predicate();
      if (result) return;
    } catch {
      // Predicate threw — treat as not-yet-met and keep polling
    }

    if (Date.now() - start >= timeout) {
      throw new Error(
        `bQuery testing: waitFor timed out after ${timeout}ms — predicate never returned true`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
