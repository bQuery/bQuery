/**
 * Component-scoped reactive primitives.
 *
 * Provides `useSignal`, `useComputed`, and `useEffect` that automatically
 * dispose when their owning component disconnects from the DOM.
 *
 * @module bquery/component
 * @internal
 */

import { Signal, signal } from '../reactive/core';
import { Computed, computed } from '../reactive/computed';
import { effect } from '../reactive/effect';
import type { CleanupFn } from '../reactive/internals';

/**
 * Holds disposable resources created inside a component scope.
 * All registered disposers run when the component disconnects.
 * @internal
 */
export interface ComponentScope {
  /** Register a cleanup function to run on dispose */
  addDisposer(fn: CleanupFn): void;
  /** Dispose all registered resources */
  dispose(): void;
}

/** Stack of active component scopes (supports nesting). @internal */
let currentScope: ComponentScope | undefined;

/**
 * Sets the active component scope.
 * @internal
 */
export function setCurrentScope(scope: ComponentScope | undefined): void {
  currentScope = scope;
}

/**
 * Returns the active component scope, or undefined if none.
 * @internal
 */
export function getCurrentScope(): ComponentScope | undefined {
  return currentScope;
}

/**
 * Creates a new component scope that tracks disposable resources.
 * @internal
 */
export function createComponentScope(): ComponentScope {
  const disposers: CleanupFn[] = [];

  return {
    addDisposer(fn: CleanupFn): void {
      disposers.push(fn);
    },
    dispose(): void {
      for (const fn of disposers) {
        try {
          fn();
        } catch (error) {
          console.error('bQuery component: Error disposing scoped resource', error);
        }
      }
      disposers.length = 0;
    },
  };
}

/**
 * Creates a reactive signal scoped to the current component.
 *
 * The signal is automatically disposed when the component disconnects
 * from the DOM, removing all subscribers and preventing memory leaks.
 *
 * Must be called during a component lifecycle hook (`connected`,
 * `beforeMount`) or inside `render()`.
 *
 * @template T - The type of the signal value
 * @param initialValue - The initial value of the signal
 * @returns A new Signal instance that auto-disposes with the component
 * @throws {Error} If called outside a component scope
 *
 * @example
 * ```ts
 * import { component, html, useSignal } from '@bquery/bquery/component';
 *
 * component('my-counter', {
 *   connected() {
 *     const count = useSignal(0);
 *     // count.dispose() is called automatically on disconnect
 *   },
 *   render({ state }) {
 *     return html`<span>${state.count}</span>`;
 *   },
 * });
 * ```
 */
export function useSignal<T>(initialValue: T): Signal<T> {
  const scope = currentScope;
  if (!scope) {
    throw new Error(
      'bQuery component: useSignal() must be called inside a component lifecycle hook or render function'
    );
  }
  const s = signal(initialValue);
  scope.addDisposer(() => s.dispose());
  return s;
}

/**
 * Creates a computed value scoped to the current component.
 *
 * The computed value's internal effect is automatically cleaned up
 * when the component disconnects from the DOM.
 *
 * Must be called during a component lifecycle hook (`connected`,
 * `beforeMount`) or inside `render()`.
 *
 * @template T - The type of the computed value
 * @param fn - Derivation function that reads reactive sources
 * @returns A new Computed instance that auto-cleans-up with the component
 * @throws {Error} If called outside a component scope
 *
 * @example
 * ```ts
 * import { component, html, useSignal, useComputed } from '@bquery/bquery/component';
 *
 * component('my-doubler', {
 *   connected() {
 *     const count = useSignal(1);
 *     const doubled = useComputed(() => count.value * 2);
 *   },
 *   render({ state }) {
 *     return html`<span>${state.doubled}</span>`;
 *   },
 * });
 * ```
 */
export function useComputed<T>(fn: () => T): Computed<T> {
  const scope = currentScope;
  if (!scope) {
    throw new Error(
      'bQuery component: useComputed() must be called inside a component lifecycle hook or render function'
    );
  }
  // Computed has no explicit dispose() method, so we wrap it in an effect
  // that reads its value. Disposing the wrapping effect causes
  // clearDependencies() to unsubscribe the computed's internal markDirty
  // observer from all upstream sources, preventing stale updates.
  const c = computed(fn);

  // We track the computed by reading it inside an effect so that the
  // effect's dependencies include the computed's sources. When we dispose
  // the effect, the computed's markDirty callback gets unsubscribed.
  const cleanup = effect(() => {
    void c.value;
  });
  scope.addDisposer(cleanup);

  return c;
}

/**
 * Creates a side effect scoped to the current component.
 *
 * The effect runs immediately and re-runs when its reactive dependencies
 * change. It is automatically disposed when the component disconnects
 * from the DOM.
 *
 * Must be called during a component lifecycle hook (`connected`,
 * `beforeMount`) or inside `render()`.
 *
 * @param fn - The effect function; may return a cleanup function
 * @returns A cleanup function to manually stop the effect early
 * @throws {Error} If called outside a component scope
 *
 * @example
 * ```ts
 * import { component, useSignal, useEffect } from '@bquery/bquery/component';
 *
 * component('my-logger', {
 *   connected() {
 *     const count = useSignal(0);
 *     useEffect(() => {
 *       console.log('Count changed:', count.value);
 *       return () => console.log('Cleanup');
 *     });
 *   },
 *   render() { return '<p>Logger</p>'; },
 * });
 * ```
 */
export function useEffect(fn: () => void | CleanupFn): CleanupFn {
  const scope = currentScope;
  if (!scope) {
    throw new Error(
      'bQuery component: useEffect() must be called inside a component lifecycle hook or render function'
    );
  }
  const cleanup = effect(fn);
  scope.addDisposer(cleanup);
  return cleanup;
}
