import { evaluate, evaluateRaw } from '../evaluate';
import { trustedHtmlForSink } from '../../security/index';
import { effect, untrack } from '../../reactive/index';
import type { DirectiveHandler } from '../types';

/**
 * Handles bq-once directive - evaluates expression once on mount and writes
 * the result as text content. Does NOT subscribe to signal updates — useful
 * for static interpolation that should not become a reactive dependency.
 *
 * @internal
 * @since 1.14.0
 */
export const handleOnce: DirectiveHandler = (el, expression, context) => {
  // untrack: inside bq-for this runs within the reconciler's effect, and the
  // one-time read must not subscribe that effect to the expression's signals.
  const value = untrack(() => evaluate<unknown>(expression, context));
  el.textContent = String(value ?? '');
};

/**
 * Handles bq-init directive - runs an expression once on mount.
 * Complements `bq-on:click`-style listeners for mount-time side effects.
 *
 * @internal
 * @since 1.14.0
 */
export const handleInit: DirectiveHandler = (el, expression, context) => {
  // untrack: a mount-time side effect must not become a dependency of an
  // enclosing effect (e.g. the bq-for reconciler processing a new row).
  untrack(() => evaluateRaw(expression, { ...context, $el: el }));
};

/**
 * Handles bq-html-safe directive - always-sanitized innerHTML binding,
 * regardless of the mount-level `sanitize` option. Safer alternative to
 * `bq-html` when individual bindings must remain sanitized in a view that
 * is otherwise mounted with `sanitize: false`.
 *
 * @internal
 * @since 1.14.0
 */
export const handleHtmlSafe: DirectiveHandler = (el, expression, context, cleanups) => {
  let previousHtml: string | undefined;
  const cleanup = effect(() => {
    const value = evaluate<string>(expression, context);
    const html = String(value ?? '');
    // Skip the sanitizer and HTML parser when the markup is unchanged.
    if (html === previousHtml) return;
    previousHtml = html;
    el.innerHTML = trustedHtmlForSink(html);
  });
  cleanups.push(cleanup);
};

/**
 * Handles bq-memo directive - marks an expression for one-time evaluation on
 * mount without creating reactive subscriptions.
 *
 * Currently implemented as a lightweight marker so authors can colocate
 * intent without creating reactive subscriptions. It still evaluates the
 * expression once on mount to surface any logged runtime errors without
 * subscribing to future updates.
 *
 * @internal
 * @since 1.14.0
 */
export const handleMemo: DirectiveHandler = (_el, expression, context) => {
  // Evaluate once so malformed expressions surface a logged runtime error
  // during mount, but do not subscribe to future updates — untracked so an
  // enclosing effect (e.g. the bq-for reconciler) is not subscribed either.
  untrack(() => evaluate(expression, context));
};
