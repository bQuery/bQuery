/**
 * Types for the bQuery testing utilities module.
 * @module bquery/testing
 */

import type { Signal } from '../reactive/core';
// ---------------------------------------------------------------------------
// renderComponent
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
  readonly currentRoute: Signal<Route>;
  /** Registered routes. */
  readonly routes: MockRouteDefinition[];
  /** Destroy and clean up. */
  destroy(): void;
}

/**
 * Minimal route shape for the mock router.
 */
export interface Route {
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
 * Options for dispatching a synthetic event.
 */
export interface FireEventOptions {
  /** Whether the event bubbles. Defaults to `true`. */
  bubbles?: boolean;
  /** Whether the event is cancelable. Defaults to `true`. */
  cancelable?: boolean;
  /** Whether the event crosses shadow DOM boundaries. Defaults to `true`. */
  composed?: boolean;
  /** Extra detail data for CustomEvent. */
  detail?: unknown;
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
