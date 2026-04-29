/**
 * Async data helpers for SSR.
 *
 * These tiny utilities let `renderToStringAsync()`/`renderToStream()` await
 * `Promise`-shaped values inside the binding context before the templates are
 * evaluated, without coupling the synchronous renderer to async semantics.
 *
 * @module bquery/ssr
 */

import { isComputed, isSignal, type Signal } from '../reactive/index';
import type { BindingContext } from '../view/types';
import type { SSRContext } from './context';
import { DEFER_BRAND } from './defer-brand';

/** A loader function executed before render. */
export type SSRLoader<T = unknown> = (ctx: SSRContext) => T | Promise<T>;

/**
 * Wraps a loader so it can be invoked or stored uniformly. The wrapper is
 * tagged with the internal defer brand so `resolveContext()` recognises it
 * and calls the loader with the active `SSRContext`.
 */
export const defineLoader = <T>(loader: SSRLoader<T>): SSRLoader<T> => {
  Object.defineProperty(loader, DEFER_BRAND, {
    value: true,
    enumerable: false,
    configurable: true,
  });
  return loader;
};

interface DeferredValue<T> {
  [DEFER_BRAND]: true;
  promise: Promise<T>;
  fallback?: unknown;
}

/**
 * Marks a promise as "may resolve in parallel". When `renderToStringAsync()`
 * sees a deferred value in the context, it awaits the underlying promise.
 * Streaming renderers can flush a fallback first and patch the resolved value
 * later (see `renderToStreamSuspense()`).
 */
export const defer = <T>(promise: Promise<T> | T, fallback?: unknown): DeferredValue<T> => {
  const p = promise instanceof Promise ? promise : Promise.resolve(promise);
  return {
    [DEFER_BRAND]: true,
    promise: p,
    fallback,
  };
};

const isDeferred = (value: unknown): value is DeferredValue<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  (value as Record<symbol, unknown>)[DEFER_BRAND] === true;

/**
 * Walks the binding context, awaits all promises and deferred values, and
 * returns a new context with the resolved values. Signals/computeds are kept
 * as-is so the renderer can still unwrap them lazily.
 *
 * @internal
 */
export const resolveContext = async (
  context: BindingContext,
  ctx: SSRContext
): Promise<BindingContext> => {
  const out: BindingContext = {};
  const entries = Object.entries(context);
  await Promise.all(
    entries.map(async ([key, value]) => {
      if (isSignal(value) || isComputed(value)) {
        out[key] = value;
        return;
      }
      if (isDeferred(value)) {
        try {
          out[key] = await value.promise;
        } catch (error) {
          ctx.reportError(error);
          out[key] = value.fallback;
        }
        return;
      }
      if (value && typeof (value as Promise<unknown>).then === 'function') {
        try {
          out[key] = await (value as Promise<unknown>);
        } catch (error) {
          ctx.reportError(error);
          out[key] = undefined;
        }
        return;
      }
      if (
        typeof value === 'function' &&
        (value as unknown as { [DEFER_BRAND]?: unknown })[DEFER_BRAND]
      ) {
        // Allow loader-style functions tagged via defineLoader to opt in.
        try {
          out[key] = await Promise.resolve((value as SSRLoader)(ctx));
        } catch (error) {
          ctx.reportError(error);
          out[key] = undefined;
        }
        return;
      }
      out[key] = value;
    })
  );
  // Carry forward signals untouched so unwrap() in the evaluator still works.
  for (const [key, value] of Object.entries(context)) {
    if (!(key in out) && (isSignal(value) || isComputed(value))) {
      out[key] = value as Signal<unknown>;
    }
  }
  return out;
};
