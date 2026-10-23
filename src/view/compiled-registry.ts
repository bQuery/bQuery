/**
 * Registry of ahead-of-time compiled `bq-*` expression functions, seeded by
 * the optional `@bquery/bquery/view/compiler` build step.
 *
 * Kept in its own dependency-free module so both the runtime evaluator and the
 * compiler entry (which re-exports the registration hooks) share one registry
 * without the compiler pulling in the runtime evaluator.
 *
 * Expressions and `bq-on` statement lists are compiled in different modes, so
 * they live in separate maps: the same source string can be a valid statement
 * list for `bq-on` while being an error as an expression elsewhere (e.g.
 * `bq-show="a(); b()"`), and the two must never be served for each other.
 *
 * @module bquery/view
 * @internal
 */

import type { BindingContext } from './types';

/** A precompiled function: takes the binding context, returns the value. */
export type CompiledExpressionFn = (ctx: BindingContext) => unknown;

/** Expression-mode entries, used by `evaluate()` / `evaluateRaw()`. @internal */
const expressionRegistry = new Map<string, CompiledExpressionFn>();

/** Statement-mode entries (`bq-on` handlers), used by `evaluateStatements()`. @internal */
const statementRegistry = new Map<string, CompiledExpressionFn>();

/**
 * Registers ahead-of-time compiled expression functions produced by the
 * optional view compiler ({@link https://bquery.js.org/guide/view | view guide}).
 *
 * Each function must accept the binding context (or its lazy proxy) and return
 * the expression's value — exactly the calling convention the runtime evaluator
 * uses — so the same function serves both signal-unwrapping and raw
 * evaluation. Registering an expression is purely an optimization:
 * unregistered expressions still evaluate at runtime, unchanged.
 *
 * `expressions` holds single expressions for every directive. `statements`
 * holds `bq-on` handlers compiled as `;`-separated statement lists; they are
 * only used for `bq-on`, so a source registered there never answers another
 * directive's expression (and vice versa). A `bq-on` handler that is a single
 * expression may also be served from `expressions`, so modules emitted before
 * statement lists existed keep working unchanged.
 *
 * This is normally called by the module emitted from
 * `@bquery/bquery/view/compiler`, not by hand.
 *
 * @param expressions - Map of expression source → compiled function.
 * @param statements - Map of `bq-on` handler source → compiled statement-list function.
 *
 * @example
 * ```ts
 * import { registerCompiledExpressions } from '@bquery/bquery/view';
 *
 * registerCompiledExpressions(
 *   { 'count + 1': ($ctx) => $ctx.count + 1 },
 *   { 'save(); close()': ($ctx) => ($ctx.save(), $ctx.close()) }
 * );
 * ```
 */
export const registerCompiledExpressions = (
  expressions: Record<string, (ctx: BindingContext) => unknown>,
  statements?: Record<string, (ctx: BindingContext) => unknown>
): void => {
  for (const key of Object.keys(expressions)) {
    expressionRegistry.set(key, expressions[key] as CompiledExpressionFn);
  }
  if (statements) {
    for (const key of Object.keys(statements)) {
      statementRegistry.set(key, statements[key] as CompiledExpressionFn);
    }
  }
};

/**
 * Removes all registered ahead-of-time compiled expressions and statement
 * lists. Mainly useful for tests that want to assert the runtime fallback path.
 */
export const clearCompiledExpressions = (): void => {
  expressionRegistry.clear();
  statementRegistry.clear();
};

/** Looks up an expression-mode entry. @internal */
export const getCompiledExpression = (source: string): CompiledExpressionFn | undefined =>
  expressionRegistry.get(source);

/** Looks up a `bq-on` statement-mode entry. @internal */
export const getCompiledStatements = (source: string): CompiledExpressionFn | undefined =>
  statementRegistry.get(source);
