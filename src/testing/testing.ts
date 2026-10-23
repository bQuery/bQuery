/**
 * Testing utilities for bQuery.js.
 *
 * Provides helpers for mounting components, controlling signals, mocking
 * the router, dispatching events, and asserting async conditions — all
 * designed for use with `bun:test` and happy-dom.
 *
 * @module bquery/testing
 */

import { batch, Signal, signal } from '../reactive/index';
import { getNormalizedRouteConstraint } from '../router/constraints';
import type {
  FireEventOptions,
  MockRouteDefinition,
  MockRouter,
  MockRouterOptions,
  MockSignal,
  RenderComponentOptions,
  RenderResult,
  TestRoute,
  WaitForOptions,
} from './types';

let renderComponentTracker: ((result: RenderResult) => void) | undefined;

/** @internal */
export const __setRenderComponentTracker = (tracker?: (result: RenderResult) => void): void => {
  renderComponentTracker = tracker;
};

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

const routeConstraintRegexCache = new Map<string, RegExp>();

const getRouteConstraintRegex = (constraint: string): RegExp => {
  const normalized = getNormalizedRouteConstraint(constraint);
  const cached = routeConstraintRegexCache.get(normalized);
  if (cached) {
    return cached;
  }

  const compiled = new RegExp(`^(?:${normalized})$`);
  routeConstraintRegexCache.set(normalized, compiled);
  return compiled;
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
          const safeSlotName = slotName
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          parts.push(`<div slot="${safeSlotName}">${html}</div>`);
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

  const result = { el, unmount };
  renderComponentTracker?.(result);
  return result;
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
function parsePath(
  fullPath: string,
  base: string
): { path: string; query: Record<string, string | string[]>; hash: string } {
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
    const params = matchRoutePattern(route.path, path);
    if (params) {
      return { matched: route, params };
    }
  }
  return { matched: null, params: {} };
}

/**
 * Builds param matches from a route path pattern without compiling the full path into a regex.
 * @internal
 */
function matchRoutePattern(pattern: string, path: string): Record<string, string> | null {
  if (pattern === '*') {
    return {};
  }

  // Memoization keeps wildcard/param backtracking linear for repeated subproblems
  // within a single pattern/path match attempt.
  const memo = new Map<string, Record<string, string> | null>();

  const findSegmentBoundary = (value: string, startIndex: number): number => {
    const slashIndex = value.indexOf('/', startIndex);
    return slashIndex === -1 ? value.length : slashIndex;
  };

  const matchFrom = (patternIndex: number, pathIndex: number): Record<string, string> | null => {
    const memoKey = `${patternIndex}:${pathIndex}`;
    if (memo.has(memoKey)) {
      return memo.get(memoKey) ?? null;
    }

    if (patternIndex === pattern.length) {
      const result = pathIndex === path.length ? {} : null;
      memo.set(memoKey, result);
      return result;
    }

    const patternChar = pattern[patternIndex];

    if (patternChar === '*') {
      for (let candidateEnd = path.length; candidateEnd >= pathIndex; candidateEnd--) {
        const suffixMatch = matchFrom(patternIndex + 1, candidateEnd);
        if (suffixMatch) {
          memo.set(memoKey, suffixMatch);
          return suffixMatch;
        }
      }

      memo.set(memoKey, null);
      return null;
    }

    if (patternChar === ':' && isWordChar(pattern[patternIndex + 1])) {
      let nameEnd = patternIndex + 2;
      while (nameEnd < pattern.length && isWordChar(pattern[nameEnd])) {
        nameEnd++;
      }

      const name = pattern.slice(patternIndex + 1, nameEnd);
      let nextPatternIndex = nameEnd;
      let constraint: string | undefined;
      let catchAll = false;

      if (pattern[nameEnd] === '(') {
        const parsedConstraint = readRouteConstraint(pattern, nameEnd);
        if (parsedConstraint) {
          constraint = parsedConstraint.constraint;
          nextPatternIndex = parsedConstraint.endIndex;
        }
      }

      if (pattern[nextPatternIndex] === '*') {
        catchAll = true;
        nextPatternIndex++;
      }

      const candidateLimit = catchAll
        ? path.length
        : constraint
          ? path.length
          : findSegmentBoundary(path, pathIndex);

      for (let candidateEnd = candidateLimit; candidateEnd > pathIndex; candidateEnd--) {
        const candidateValue = path.slice(pathIndex, candidateEnd);
        if (constraint) {
          const constraintRegex = getRouteConstraintRegex(constraint);
          if (!constraintRegex.test(candidateValue)) {
            continue;
          }
        }

        const suffixMatch = matchFrom(nextPatternIndex, candidateEnd);
        if (suffixMatch) {
          const result = {
            [name]: candidateValue,
            ...suffixMatch,
          };
          memo.set(memoKey, result);
          return result;
        }
      }

      memo.set(memoKey, null);
      return null;
    }

    if (pathIndex >= path.length || patternChar !== path[pathIndex]) {
      memo.set(memoKey, null);
      return null;
    }

    const result = matchFrom(patternIndex + 1, pathIndex + 1);
    memo.set(memoKey, result);
    return result;
  };

  return matchFrom(0, 0);
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

  const resolveRoute = (fullPath: string): TestRoute => {
    const { path, query, hash } = parsePath(fullPath, base);
    const { matched, params } = matchRoute(path, routes);
    return { path, params, query, matched, hash };
  };

  const routeSignal = signal<TestRoute>(resolveRoute(initialPath));

  return {
    push(path: string): void {
      routeSignal.value = resolveRoute(path);
    },
    replace(path: string): void {
      routeSignal.value = resolveRoute(path);
    },
    get currentRoute(): Signal<TestRoute> {
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

type EventConstructorName =
  'MouseEvent' | 'PointerEvent' | 'KeyboardEvent' | 'InputEvent' | 'FocusEvent';

/** The `Event` subclass a browser dispatches for a well-known event name. */
const getEventConstructorName = (name: string): EventConstructorName | undefined =>
  /^(click|dblclick|auxclick|contextmenu|mouse(down|up|move|over|out|enter|leave))$/.test(name)
    ? 'MouseEvent'
    : /^(pointer(down|up|move|over|out|enter|leave|cancel)|(got|lost)pointercapture)$/.test(name)
      ? 'PointerEvent'
      : /^key(down|up|press)$/.test(name)
        ? 'KeyboardEvent'
        : /^(before)?input$/.test(name)
          ? 'InputEvent'
          : /^(focus(in|out)?|blur)$/.test(name)
            ? 'FocusEvent'
            : undefined;

/** `[bubbles, cancelable, composed]` for one event type. */
type EventFlags = readonly [bubbles: boolean, cancelable: boolean, composed: boolean];

/** Default flags for event types not listed in {@link EVENT_FLAGS} (and custom events). */
const DEFAULT_EVENT_FLAGS: EventFlags = [true, true, true];

/**
 * The `bubbles` / `cancelable` / `composed` flags a browser dispatches these
 * events with (UI Events, Pointer Events and HTML specs) where they differ
 * from the all-`true` default used for every other event name.
 */
const EVENT_FLAGS = new Map<string, EventFlags>([
  // Focus: `focus` / `blur` don't bubble; `focusin` / `focusout` do. None cancel.
  ['focus', [false, false, true]],
  ['blur', [false, false, true]],
  ['focusin', [true, false, true]],
  ['focusout', [true, false, true]],
  // Boundary events are sent to each element entered / left and stay in their tree.
  ['mouseenter', [false, false, false]],
  ['mouseleave', [false, false, false]],
  ['pointerenter', [false, false, false]],
  ['pointerleave', [false, false, false]],
  ['pointercancel', [true, false, true]],
  ['gotpointercapture', [true, false, true]],
  ['lostpointercapture', [true, false, true]],
  ['touchcancel', [true, false, true]],
  // Editing and forms.
  ['input', [true, false, true]],
  ['compositionupdate', [true, false, true]],
  ['compositionend', [true, false, true]],
  ['change', [true, false, false]],
  ['select', [true, false, false]],
  ['submit', [true, true, false]],
  ['reset', [true, true, false]],
  ['invalid', [false, true, false]],
  ['toggle', [false, false, false]],
  // Resource and scroll events fired at elements.
  ['load', [false, false, false]],
  ['error', [false, false, false]],
  ['abort', [false, false, false]],
  ['scroll', [false, false, false]],
  ['scrollend', [false, false, false]],
  // CSS animations and transitions.
  ['animationstart', [true, false, false]],
  ['animationend', [true, false, false]],
  ['animationiteration', [true, false, false]],
  ['animationcancel', [true, false, false]],
  ['transitionrun', [true, false, false]],
  ['transitionstart', [true, false, false]],
  ['transitionend', [true, false, false]],
  ['transitioncancel', [true, false, false]],
]);

/**
 * Per-event defaults that mirror what a browser sends for a primary-button
 * mouse / pointer interaction (`button: 0`, a click count in `detail`, ...).
 */
const getEventDefaults = (
  name: string,
  ctor: EventConstructorName
): MouseEventInit & PointerEventInit => {
  const pointer = ctor === 'PointerEvent';
  if (!pointer && ctor !== 'MouseEvent') return {};
  const pressed = /down$/.test(name);
  const changed = pressed || /up$/.test(name);
  return {
    // A pointer event that does not change the button state reports -1.
    button: name === 'auxclick' ? 1 : name === 'contextmenu' ? 2 : pointer && !changed ? -1 : 0,
    buttons: pressed ? 1 : 0,
    detail: name === 'dblclick' ? 2 : /click$/.test(name) || (!pointer && changed) ? 1 : 0,
    ...(pointer && {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      pressure: pressed ? 0.5 : 0,
    }),
  };
};

/**
 * Creates the event with the matching subclass, preferring the global
 * constructor (what code under test compares against with `instanceof`) and
 * falling back to the element's own window, e.g. for a document created by a
 * separate happy-dom `Window`. `PointerEvent` falls back to `MouseEvent`.
 */
const createTypedEvent = (
  el: Element,
  name: string,
  ctor: EventConstructorName | undefined,
  init: EventInit
): Event => {
  type Ctor = new (type: string, init?: EventInit) => Event;
  const view = el.ownerDocument?.defaultView as unknown as Record<string, Ctor | undefined> | null;
  const global = globalThis as unknown as Record<string, Ctor | undefined>;
  for (const ctorName of ctor === 'PointerEvent' ? [ctor, 'MouseEvent'] : ctor ? [ctor] : []) {
    const EventCtor = global[ctorName] ?? view?.[ctorName];
    if (typeof EventCtor === 'function') return new EventCtor(name, init);
  }
  return new Event(name, init);
};

const assertFireEventElement = (el: Element): void => {
  if (!el) {
    throw new Error('bQuery testing: fireEvent requires a valid element');
  }
};

/**
 * Dispatches a synthetic event on an element and flushes pending effects.
 *
 * The event gets the `bubbles` / `cancelable` / `composed` flags a browser
 * uses for that event type: `focus`, `blur`, `mouseenter`, `mouseleave`,
 * `pointerenter`, `pointerleave`, `load` and `scroll` don't bubble; `input`,
 * `change`, `focus*` and `blur` aren't cancelable; `change`, `submit`,
 * `reset`, `mouseenter` / `mouseleave` and `pointerenter` / `pointerleave`
 * aren't composed (don't leave a shadow root). Every other event — including
 * custom event names — bubbles, is cancelable and is composed. `bubbles`,
 * `cancelable` and `composed` in `options` override these defaults.
 *
 * Well-known event names are dispatched with the matching `Event` subclass,
 * the way a browser sends them:
 *
 * - `click`, `dblclick`, `mousedown`, `mouseup`, `mouseover`, `contextmenu`, ...
 *   → `MouseEvent` (`button: 0` for the primary button, `detail` = click count)
 * - `pointerdown`, `pointerup`, `pointermove`, ... → `PointerEvent`
 *   (`pointerType: 'mouse'`, `pointerId: 1`, `isPrimary: true`)
 * - `keydown`, `keyup`, `keypress` → `KeyboardEvent`
 * - `input`, `beforeinput` → `InputEvent`
 * - `focus`, `blur`, `focusin`, `focusout` → `FocusEvent`
 *
 * Any other event init field (`button`, `key`, `ctrlKey`, `clientX`, ...)
 * passed in `options` overrides those defaults. A non-numeric `detail` (or a
 * `detail` on an event name not listed above) creates a `CustomEvent` instead.
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
 * fireEvent(button, 'click', { button: 1, ctrlKey: true });
 * ```
 */
const baseFireEvent = (el: Element, eventName: string, options: FireEventOptions = {}): boolean => {
  assertFireEventElement(el);
  if (!eventName) {
    throw new Error('bQuery testing: fireEvent requires an event name');
  }

  const flags = EVENT_FLAGS.get(eventName) ?? DEFAULT_EVENT_FLAGS;
  const {
    bubbles = flags[0],
    cancelable = flags[1],
    composed = flags[2],
    detail,
    ...init
  } = options;
  const ctor = getEventConstructorName(eventName);

  let event: Event;
  if (detail !== undefined && (typeof detail !== 'number' || !ctor)) {
    event = new CustomEvent(eventName, { bubbles, cancelable, composed, detail });
  } else {
    event = createTypedEvent(el, eventName, ctor, {
      ...(ctor ? getEventDefaults(eventName, ctor) : {}),
      ...(detail !== undefined ? { detail } : {}),
      ...init,
      bubbles,
      cancelable,
      composed,
    } as EventInit);
  }

  const result = el.dispatchEvent(event);

  // Flush any effects triggered by event handlers
  flushEffects();

  return result;
};

// Attach shortcut methods (1.14+) so callers can use `fireEvent.click(el)`,
// `fireEvent.input(el, 'value')`, etc.
/** @internal */
export const __getTextInputElement = (
  el: Element
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => {
  const tagName = el.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  }

  throw new Error(
    'bQuery testing: fireEvent.input/change requires an input, textarea, or select element'
  );
};

const setInputValue = (el: Element, value: string): void => {
  __getTextInputElement(el).value = value;
};

interface FireEventShortcuts {
  click: (el: Element, init?: FireEventOptions) => boolean;
  dblClick: (el: Element, init?: FireEventOptions) => boolean;
  input: (el: Element, value: string, init?: FireEventOptions) => boolean;
  change: (el: Element, value: string, init?: FireEventOptions) => boolean;
  submit: (el: Element, init?: FireEventOptions) => boolean;
  focus: (el: Element, init?: FireEventOptions) => boolean;
  blur: (el: Element, init?: FireEventOptions) => boolean;
  keyDown: (el: Element, init?: FireEventOptions) => boolean;
  keyUp: (el: Element, init?: FireEventOptions) => boolean;
}

const shortcuts: FireEventShortcuts = {
  click: (el, init) => baseFireEvent(el, 'click', init),
  dblClick: (el, init) => baseFireEvent(el, 'dblclick', init),
  input: (el, value, init) => {
    setInputValue(el, value);
    return baseFireEvent(el, 'input', init);
  },
  change: (el, value, init) => {
    setInputValue(el, value);
    return baseFireEvent(el, 'change', init);
  },
  submit: (el, init) => baseFireEvent(el, 'submit', init),
  focus: (el, init) => baseFireEvent(el, 'focus', init),
  blur: (el, init) => baseFireEvent(el, 'blur', init),
  keyDown: (el, init) => baseFireEvent(el, 'keydown', init),
  keyUp: (el, init) => baseFireEvent(el, 'keyup', init),
};

type FireEventFn = ((el: Element, eventName: string, options?: FireEventOptions) => boolean) &
  FireEventShortcuts;

export const fireEvent: FireEventFn = Object.assign(baseFireEvent, shortcuts);

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

    const remaining = timeout - (Date.now() - start);
    if (remaining <= 0) {
      throw new Error(
        `bQuery testing: waitFor timed out after ${timeout}ms — predicate never returned true`
      );
    }

    // Never sleep past the deadline: the last check runs when the timeout is due.
    await new Promise((resolve) => setTimeout(resolve, Math.min(interval, remaining)));
  }
}
