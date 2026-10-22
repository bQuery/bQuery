/**
 * Types for the bQuery testing utilities module.
 * @module bquery/testing
 */

import type { Signal } from '../reactive/index';
// ---------------------------------------------------------------------------
// routing / mockRouter route types
// ---------------------------------------------------------------------------

/**
 * Minimal route shape accepted by the testing mock router.
 */
export interface MockRouteDefinition {
  path: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// renderComponent
// ---------------------------------------------------------------------------

/**
 * Options for mounting a bQuery component in tests.
 */
export interface RenderComponentOptions {
  /**
   * Attributes (props) to set on the custom element.
   * Keys are attribute names; values are stringified automatically.
   *
   * @example
   * ```ts
   * renderComponent('my-counter', { props: { start: 5 } });
   * ```
   */
  props?: Record<string, unknown>;

  /**
   * Named or default slot content to inject inside the host element
   * **before** it is connected to the DOM.
   *
   * - A plain string sets the default (unnamed) slot.
   * - An object maps slot names to HTML strings.
   *
   * @example
   * ```ts
   * renderComponent('my-card', {
   *   slots: { default: '<p>Body</p>', header: '<h2>Title</h2>' },
   * });
   * ```
   */
  slots?: string | Record<string, string>;

  /**
   * Parent element to attach to. Defaults to `document.body`.
   */
  container?: HTMLElement;
}

/**
 * Return value of {@link renderComponent}.
 */
export interface RenderResult {
  /** The mounted custom element instance. */
  el: HTMLElement;
  /** Remove the element and run cleanup. */
  unmount: () => void;
}

// ---------------------------------------------------------------------------
// mockSignal
// ---------------------------------------------------------------------------

/**
 * A controllable signal for use in tests.
 *
 * Extends the regular Signal with explicit `set()` and `reset()` helpers
 * that make test intent clearer.
 */
export interface MockSignal<T> extends Signal<T> {
  /**
   * Explicitly set the signal value (alias for `.value = v`).
   */
  set(value: T): void;

  /**
   * Reset the signal back to its initial value.
   */
  reset(): void;

  /**
   * The initial value this mock was created with.
   */
  readonly initialValue: T;
}

// ---------------------------------------------------------------------------
// mockRouter
// ---------------------------------------------------------------------------

/**
 * Options for creating a mock router.
 */
export interface MockRouterOptions {
  /** Route definitions. Defaults to a single catch-all route. */
  routes?: MockRouteDefinition[];
  /** Initial path. Defaults to '/'. */
  initialPath?: string;
  /** Base path. Defaults to ''. */
  base?: string;
}

/**
 * A lightweight mock router for tests that doesn't touch the History API.
 */
export interface MockRouter {
  /** Navigate to a path (synchronous, no guards). */
  push(path: string): void;
  /** Replace the current path. */
  replace(path: string): void;
  /** The current route (reactive signal). */
  readonly currentRoute: Signal<TestRoute>;
  /** Registered routes. */
  readonly routes: MockRouteDefinition[];
  /** Destroy and clean up. */
  destroy(): void;
}

/**
 * Minimal route shape for the mock router.
 */
export interface TestRoute {
  path: string;
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  matched: MockRouteDefinition | null;
  hash: string;
}

// ---------------------------------------------------------------------------
// fireEvent
// ---------------------------------------------------------------------------

/**
 * Event-specific init fields accepted by {@link FireEventOptions} — the union
 * of `MouseEventInit`, `PointerEventInit`, `KeyboardEventInit`,
 * `InputEventInit` and `FocusEventInit` (e.g. `button`, `ctrlKey`, `clientX`,
 * `key`, `inputType`, `relatedTarget`). They override the defaults `fireEvent`
 * picks for the event type.
 */
export type FireEventInit = Omit<
  MouseEventInit & PointerEventInit & KeyboardEventInit & InputEventInit & FocusEventInit,
  'bubbles' | 'cancelable' | 'composed' | 'detail'
>;

/**
 * Options for dispatching a synthetic event.
 */
export interface FireEventOptions extends FireEventInit {
  /**
   * Whether the event bubbles. Defaults to what a browser uses for the event
   * type: `false` for `focus`, `blur`, `mouseenter`, `mouseleave`,
   * `pointerenter`, `pointerleave`, `load`, `scroll`, ...; `true` otherwise.
   */
  bubbles?: boolean;
  /**
   * Whether the event is cancelable. Defaults to what a browser uses for the
   * event type: `false` for `input`, `change`, `focus`, `blur`, `mouseenter`,
   * ...; `true` otherwise.
   */
  cancelable?: boolean;
  /**
   * Whether the event crosses shadow DOM boundaries. Defaults to what a
   * browser uses for the event type: `false` for `change`, `submit`, `reset`,
   * `mouseenter`, `mouseleave`, `pointerenter`, `pointerleave`, ...; `true`
   * otherwise.
   */
  composed?: boolean;
  /**
   * Extra detail data. A non-numeric value (or any value for an event name
   * without a dedicated `Event` subclass) dispatches a `CustomEvent`; a number
   * on a mouse / pointer / keyboard / input / focus event sets its UI `detail`.
   */
  detail?: unknown;
}

// ---------------------------------------------------------------------------
// screen / within queries
// ---------------------------------------------------------------------------

/**
 * Options for the `*ByRole` queries on `screen` and `within()`.
 */
export interface ByRoleOptions {
  /**
   * Only match elements whose accessible name matches. The name is computed
   * from `aria-labelledby`, then `aria-label`, then associated `<label>`s
   * (form controls), `alt` (images), and finally the text content for roles
   * named from content (buttons, links, headings, ...). It is trimmed and its
   * whitespace collapsed. A string must equal the name exactly (after the same
   * normalisation); a RegExp is tested against it.
   */
  name?: string | RegExp;
}

// ---------------------------------------------------------------------------
// waitFor
// ---------------------------------------------------------------------------

/**
 * Options for the async `waitFor` helper.
 */
export interface WaitForOptions {
  /** Maximum time (ms) to wait before timing out. Defaults to 1000. */
  timeout?: number;
  /** Polling interval (ms). Defaults to 10. */
  interval?: number;
}
