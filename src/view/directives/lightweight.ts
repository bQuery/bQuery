import { evaluate, evaluateRaw } from '../evaluate';
import { sanitizeHtml } from '../../security/index';
import { effect } from '../../reactive/index';
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
  const value = evaluate<unknown>(expression, context);
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
  evaluateRaw(expression, { ...context, $el: el });
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
  const cleanup = effect(() => {
    const value = evaluate<string>(expression, context);
    el.innerHTML = sanitizeHtml(String(value ?? ''));
  });
  cleanups.push(cleanup);
};

/**
 * Handles bq-memo directive - re-renders subtree only when the dependency
 * tuple changes. The expression must evaluate to an array of dependencies.
 *
 * Currently implemented as a no-op marker so authors can colocate the
 * intent; the actual memoization is performed inline by the for-loop
 * reconciler when `bq-memo` appears alongside `bq-for`. For top-level
 * memoization, this serves as a future extension point — for now it simply
 * evaluates the expression once on mount to surface any errors early.
 *
 * @internal
 * @since 1.14.0
 */
export const handleMemo: DirectiveHandler = (_el, expression, context) => {
  // Evaluate once so authors get an immediate failure for malformed
  // expressions, but do not subscribe — the directive's reactive contract
  // is handled by the surrounding directive (e.g. bq-for keying).
  evaluate(expression, context);
};
