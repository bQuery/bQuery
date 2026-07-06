/**
 * Reactive effect scopes for grouped disposal.
 *
 * An `EffectScope` collects all effects, computed values, and watches created
 * inside its `run()` callback so they can be disposed together with a single
 * `stop()` call. Scopes nest — an inner scope is collected by its parent.
 *
 * @module bquery/reactive
 */

import type { CleanupFn } from './internals';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A scope that collects reactive resources for grouped disposal.
 *
 * @example
 * ```ts
 * import { effectScope, signal, effect, computed } from '@bquery/bquery/reactive';
 *
 * const scope = effectScope();
 *
 * scope.run(() => {
 *   const count = signal(0);
 *   effect(() => console.log(count.value));
 *   const doubled = computed(() => count.value * 2);
 * });
 *
 * scope.stop(); // All effects and computed values disposed
 * ```
 */
export interface EffectScope {
  /** Whether the scope has not yet been stopped. */
  readonly active: boolean;

  /**
   * Executes `fn` inside this scope, collecting any reactive resources
   * (effects, computed values, watches, nested scopes) created during the call.
   *
   * `run()` is synchronous-only. Do not pass an async function or a function
   * that returns a Promise — resources created after an `await` cannot be
   * collected reliably.
   *
   * @template T - Return type of the provided function
   * @param fn - Function to run inside the scope
   * @returns The return value of `fn`
   * @throws {Error} If the scope has already been stopped
   */
  run<T>(fn: () => T): T;

  /**
   * Disposes all collected resources and marks the scope as inactive.
   * Calling `stop()` on an already-stopped scope is a safe no-op.
   */
  stop(): void;
}

// ---------------------------------------------------------------------------
// Internal scope stack
// ---------------------------------------------------------------------------

/** @internal */
interface ScopeInternal extends EffectScope {
  /** @internal – Register a cleanup callback to run when the scope stops. */
  _addDisposer(fn: CleanupFn): void;
}

const scopeStack: ScopeInternal[] = [];

/** @internal */
export const hasScopeDisposer = (
  scope: EffectScope | undefined
): scope is EffectScope & { _addDisposer(fn: CleanupFn): void } =>
  typeof scope === 'object' && scope !== null && '_addDisposer' in scope;

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === 'object' || typeof value === 'function') &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

/**
 * Best-effort detection for native async functions so `run()` can reject them
 * before invocation. Transpiled async functions may not preserve this shape, so
 * promise-like return values are still checked after execution as a fallback.
 * @internal
 */
const isAsyncFunction = (value: unknown): value is (...args: never[]) => Promise<unknown> => {
  const constructorName =
    typeof (value as { constructor?: unknown }).constructor === 'function'
      ? (value as { constructor: { name?: unknown } }).constructor.name
      : undefined;

  return (
    typeof value === 'function' &&
    ((Symbol.toStringTag in value &&
      (value as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag] === 'AsyncFunction') ||
      constructorName === 'AsyncFunction')
  );
};

/**
 * Returns the currently active scope, or `undefined` if none.
 * @internal
 */
export const getActiveScope = (): EffectScope | undefined => {
  for (let i = scopeStack.length - 1; i >= 0; i--) {
    if (scopeStack[i].active) {
      return scopeStack[i];
    }
  }

  return undefined;
};

// ---------------------------------------------------------------------------
// EffectScope implementation
// ---------------------------------------------------------------------------

class EffectScopeImpl implements ScopeInternal {
  private disposers: CleanupFn[] = [];
  private _active = true;

  get active(): boolean {
    return this._active;
  }

  /** @internal */
  _addDisposer(fn: CleanupFn): void {
    if (this._active) {
      this.disposers.push(fn);
    }
  }

  run<T>(fn: () => T): T {
    if (!this._active) {
      throw new Error('bQuery reactive: Cannot run in a stopped effectScope');
    }
    if (isAsyncFunction(fn)) {
      throw new Error('bQuery reactive: effectScope.run() only supports synchronous callbacks');
    }

    scopeStack.push(this);
    try {
      const result = fn();
      if (isPromiseLike(result)) {
        this.stop();
        throw new Error('bQuery reactive: effectScope.run() only supports synchronous callbacks');
      }
      return result;
    } finally {
      scopeStack.pop();
    }
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;

    // Dispose in reverse order (LIFO) to mirror creation order
    for (let i = this.disposers.length - 1; i >= 0; i--) {
      try {
        this.disposers[i]();
      } catch (error) {
        console.error('bQuery reactive: Error in scope cleanup', error);
      }
    }
    this.disposers.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new effect scope for grouped disposal of reactive resources.
 *
 * All `effect()`, `computed()`, `watch()`, and nested `effectScope()` calls
 * made inside `scope.run(fn)` are automatically collected. Calling
 * `scope.stop()` disposes them all at once.
 *
 * `run()` is synchronous-only. Create the scope outside async flows when
 * needed, but keep the callback itself synchronous so cleanup registration
 * stays deterministic.
 *
 * @param detached - When `true`, the scope is NOT auto-collected by an
 *   enclosing scope; its lifetime is fully independent (tie it to something
 *   else and call `stop()` yourself). Defaults to `false`.
 * @returns A new {@link EffectScope}
 *
 * @example
 * ```ts
 * import { effectScope, signal, effect, onScopeDispose } from '@bquery/bquery/reactive';
 *
 * const scope = effectScope();
 *
 * scope.run(() => {
 *   const count = signal(0);
 *
 *   effect(() => console.log(count.value));
 *
 *   onScopeDispose(() => {
 *     console.log('Custom cleanup');
 *   });
 * });
 *
 * scope.stop(); // logs "Custom cleanup", all effects stopped
 * ```
 */
export const effectScope = (detached = false): EffectScope => {
  const scope = new EffectScopeImpl();

  // If created inside another scope, auto-collect as a nested scope — unless
  // `detached` is requested, in which case the scope's lifetime is fully
  // independent of any parent (e.g. a resource whose disposal is tied to
  // something other than the ambient scope).
  if (!detached) {
    const parent = getActiveScope();
    if (hasScopeDisposer(parent)) {
      parent._addDisposer(() => scope.stop());
    }
  }

  return scope;
};

/**
 * Returns the currently active {@link EffectScope}, or `undefined` if
 * code is not running inside any scope's `run()` callback.
 *
 * @returns The active scope, or `undefined`
 *
 * @example
 * ```ts
 * import { effectScope, getCurrentScope } from '@bquery/bquery/reactive';
 *
 * const scope = effectScope();
 * scope.run(() => {
 *   console.log(getCurrentScope() !== undefined); // true
 * });
 *
 * console.log(getCurrentScope()); // undefined
 * ```
 */
export const getCurrentScope = (): EffectScope | undefined => getActiveScope();

/**
 * Registers a cleanup callback on the currently active scope.
 *
 * The callback runs when the scope is stopped. This is useful for
 * registering arbitrary cleanup (e.g. event listeners, timers)
 * alongside effects and computed values.
 *
 * @param fn - Cleanup function to run when the scope stops
 * @throws {Error} If called outside an active scope
 *
 * @example
 * ```ts
 * import { effectScope, onScopeDispose } from '@bquery/bquery/reactive';
 *
 * const scope = effectScope();
 *
 * scope.run(() => {
 *   const controller = new AbortController();
 *   fetch('/api/data', { signal: controller.signal });
 *
 *   onScopeDispose(() => controller.abort());
 * });
 *
 * scope.stop(); // abort() is called
 * ```
 */
export const onScopeDispose = (fn: CleanupFn): void => {
  const scope = getActiveScope();
  if (!scope || !scope.active || !hasScopeDisposer(scope)) {
    throw new Error(
      'bQuery reactive: onScopeDispose() must be called inside an active effectScope'
    );
  }
  scope._addDisposer(fn);
};
