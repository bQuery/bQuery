import { isComputed, isSignal, type Signal } from '../reactive/index';
import { getCompiledExpression, getCompiledStatements } from './compiled-registry';
import { hasDangerousMemberAccess } from './dangerous-access';
import { parseObjectExpression, splitTopLevel } from './split';
import type { BindingContext } from './types';

// Ahead-of-time compiled entries (seeded by `@bquery/bquery/view/compiler`)
// take precedence over the runtime `new Function()` path and are never
// evicted, so a build that precompiles every expression in a template avoids
// the runtime evaluator (and its `'unsafe-eval'` requirement) entirely.
// Unregistered sources transparently fall back to runtime compilation; for any
// well-formed expression the two paths produce the same value. (They differ
// only for an unresolved free identifier, which the `with`-based runtime path
// turns into a caught ReferenceError — i.e. `undefined` for the whole
// expression — whereas the compiled path reads it as `undefined` in place.)
export { clearCompiledExpressions, registerCompiledExpressions } from './compiled-registry';
export { parseObjectExpression, splitTopLevel } from './split';

/** A cached compiled function that always evaluates to `undefined`. */
const BLOCKED_FN: (ctx: BindingContext) => unknown = () => undefined;

/** Maximum number of cached expression functions before LRU eviction */
const MAX_CACHE_SIZE = 500;

/** Compiled function type for expression evaluation */
type CompiledFn = (ctx: BindingContext) => unknown;

/**
 * Simple LRU cache for compiled expression functions.
 * Uses Map's insertion order to track recency - accessed items are re-inserted.
 * @internal
 */
class LRUCache {
  private cache = new Map<string, CompiledFn>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): CompiledFn | undefined {
    const value = this.cache.get(key);
    // Recency only matters once the cache can evict; below capacity a plain
    // hit skips the delete+set reorder on the hot path.
    if (value !== undefined && this.cache.size >= this.maxSize) {
      // Move to end (most recently used) by re-inserting
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: CompiledFn): void {
    // Delete first if exists to update insertion order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first) entry
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/** LRU cache for compiled evaluate functions, keyed by expression string */
const evaluateCache = new LRUCache(MAX_CACHE_SIZE);

/** LRU cache for compiled evaluateRaw functions, keyed by expression string */
const evaluateRawCache = new LRUCache(MAX_CACHE_SIZE);

/** LRU cache for compiled `bq-on` statement lists, keyed by source */
const statementsCache = new LRUCache(MAX_CACHE_SIZE);

/**
 * Clears all cached compiled expression functions.
 * Call this when unmounting views or to free memory after heavy template usage.
 *
 * @example
 * ```ts
 * import { clearExpressionCache } from 'bquery/view';
 *
 * // After destroying a view or when cleaning up
 * clearExpressionCache();
 * ```
 */
export const clearExpressionCache = (): void => {
  evaluateCache.clear();
  evaluateRawCache.clear();
  statementsCache.clear();
};

/**
 * Creates a proxy that lazily unwraps signals/computed only when accessed.
 * This avoids subscribing to signals that aren't referenced in the expression.
 * @internal
 */
/**
 * Identifiers that must never resolve during `with`-scoped evaluation.
 *
 * `with` resolves a free identifier via `[[HasProperty]]`, walking the
 * prototype chain. If the context proxy declines an inherited name, resolution
 * falls through to the function's enclosing scope — and the global object
 * itself inherits `constructor` from `Object.prototype` and exposes `Function`,
 * `eval`, `globalThis`, `window`, etc. So `constructor.constructor('…')()` (or
 * a bare `Function('…')()`) would still reach arbitrary code execution.
 *
 * These names are therefore *shadowed*: the proxy claims to own them (`has`
 * returns true) but resolves them to `undefined` (`get` returns undefined),
 * unless the context legitimately defines its own property of that name. Any
 * member access on the resulting `undefined` throws and evaluates to
 * `undefined`.
 * @internal
 */
const SHADOWED_GLOBALS = new Set([
  'constructor',
  '__proto__',
  'prototype',
  'Function',
  'eval',
  'globalThis',
  'global',
  'window',
  'self',
  'top',
  'parent',
]);

/**
 * `has` trap for `with`-scoped evaluation proxies. Reports own string keys and
 * the shadowed dangerous globals as present so neither resolves from an
 * inherited prototype member or the enclosing (global) scope.
 *
 * Symbol keys keep default behaviour so `with`'s internal `Symbol.unscopables`
 * probe still works.
 * @internal
 */
const hardenedHas = (target: BindingContext, prop: string | symbol): boolean => {
  if (typeof prop !== 'string') {
    return Reflect.has(target, prop);
  }
  return Object.prototype.hasOwnProperty.call(target, prop) || SHADOWED_GLOBALS.has(prop);
};

/**
 * Returns true when `prop` is a shadowed global the context does not itself own.
 * @internal
 */
const isShadowedGlobal = (target: BindingContext, prop: string): boolean =>
  SHADOWED_GLOBALS.has(prop) && !Object.prototype.hasOwnProperty.call(target, prop);

/**
 * Proxies are pure live views over their target, so one proxy per context
 * object is enough — allocating a fresh proxy per evaluation was pure garbage
 * on the hottest path in the view layer.
 * @internal
 */
const lazyContextCache = new WeakMap<BindingContext, BindingContext>();

const createLazyContext = (context: BindingContext): BindingContext => {
  const cached = lazyContextCache.get(context);
  if (cached) return cached;
  const proxy = new Proxy(context, {
    get(target, prop: string | symbol) {
      // Only handle string keys for BindingContext indexing
      if (typeof prop !== 'string') {
        return Reflect.get(target, prop);
      }
      if (isShadowedGlobal(target, prop)) {
        return undefined;
      }
      const value = target[prop];
      // Auto-unwrap signals/computed only when actually accessed
      if (isSignal(value) || isComputed(value)) {
        return (value as Signal<unknown>).value;
      }
      return value;
    },
    has: hardenedHas,
  });
  lazyContextCache.set(context, proxy);
  return proxy;
};

/**
 * Wraps a raw context so `with`-based evaluation cannot resolve inherited
 * prototype members or dangerous globals, without unwrapping signals
 * (unlike {@link createLazyContext}).
 * @internal
 */
/** One hardened proxy per context object — see {@link lazyContextCache}. @internal */
const hardenedContextCache = new WeakMap<BindingContext, BindingContext>();

const createHardenedContext = (context: BindingContext): BindingContext => {
  const cached = hardenedContextCache.get(context);
  if (cached) return cached;
  const proxy = new Proxy(context, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'string' && isShadowedGlobal(target, prop)) {
        return undefined;
      }
      return Reflect.get(target, prop);
    },
    has: hardenedHas,
  });
  hardenedContextCache.set(context, proxy);
  return proxy;
};

/**
 * Compiles a `with`-scoped function from `body`, or returns {@link BLOCKED_FN}
 * (logging why) when `expression` accesses constructor/prototype/__proto__ as
 * a member: identifier shadowing alone does not stop
 * `foo.constructor.constructor('…')()` reaching the Function constructor
 * through any reachable object.
 * @internal
 */
const compileGuarded = (expression: string, body: string): CompiledFn => {
  if (hasDangerousMemberAccess(expression)) {
    console.error(
      `bQuery view: refusing to evaluate "${expression}" — member access to constructor/prototype/__proto__ is blocked`
    );
    return BLOCKED_FN;
  }
  // `new Function()` runs in non-strict mode, so `with` is allowed.
  return new Function('$ctx', `with($ctx) { ${body} }`) as CompiledFn;
};

/**
 * Evaluates an expression in the given context using `new Function()`.
 *
 * Signals and computed values in the context are lazily unwrapped only when
 * accessed by the expression, avoiding unnecessary subscriptions to unused values.
 *
 * @security **WARNING:** This function uses dynamic code execution via `new Function()`.
 * - NEVER pass expressions derived from user input or untrusted sources
 * - Expressions should only come from developer-controlled templates
 * - Malicious expressions can access and exfiltrate context data
 * - Consider this equivalent to `eval()` in terms of security implications
 *
 * @internal
 */
export const evaluate = <T = unknown>(expression: string, context: BindingContext): T => {
  try {
    // Create a proxy that lazily unwraps signals/computed on access
    const lazyContext = createLazyContext(context);

    // Prefer an ahead-of-time compiled function when one was registered by the
    // optional view compiler — this skips the runtime `new Function()` path.
    const compiled = getCompiledExpression(expression);
    if (compiled) {
      return compiled(lazyContext) as T;
    }

    // Use cached function or compile and cache a new one
    let fn = evaluateCache.get(expression);
    if (!fn) {
      // `with` enables direct property access from the lazy proxy scope.
      fn = compileGuarded(expression, `return (${expression});`);
      evaluateCache.set(expression, fn);
    }
    return fn(lazyContext) as T;
  } catch (error) {
    reportEvaluationError(expression, error);
    return undefined as T;
  }
};

/**
 * Evaluates an expression and returns the raw value (for signal access).
 *
 * @security **WARNING:** Uses dynamic code execution. See {@link evaluate} for security notes.
 * @internal
 */
export const evaluateRaw = <T = unknown>(expression: string, context: BindingContext): T => {
  try {
    // Prefer an ahead-of-time compiled function when one was registered. The
    // raw context is passed directly (no signal unwrapping), so directives like
    // bq-model still receive the underlying signal.
    const compiled = getCompiledExpression(expression);
    if (compiled) {
      return compiled(context) as T;
    }

    // Use cached function or compile and cache a new one
    let fn = evaluateRawCache.get(expression);
    if (!fn) {
      // Unlike `evaluate`, signals are not unwrapped — but the context is still
      // wrapped in a hardened proxy (below) so `with` cannot resolve inherited
      // prototype members (e.g. `constructor.constructor`).
      fn = compileGuarded(expression, `return (${expression});`);
      evaluateRawCache.set(expression, fn);
    }
    return fn(createHardenedContext(context)) as T;
  } catch (error) {
    reportEvaluationError(expression, error);
    return undefined as T;
  }
};

/**
 * Statement keywords that cannot follow `return` — a final `bq-on` statement
 * starting with one is run as a statement and the handler returns `undefined`.
 */
const STATEMENT_START = /^(?:if|else|for|while|do|switch|try|throw|return|var|let|const)\b/;

/**
 * Evaluates a `bq-on` handler: a `;`-separated list of statements (like Vue's
 * inline handlers), e.g. `$event.preventDefault(); add()`. Statements run in
 * order and the value of the last one is returned. Separators inside strings,
 * template literals and brackets do not split, a trailing `;` and empty
 * statements are ignored, and a single expression behaves exactly like
 * {@link evaluateRaw} (signals are not unwrapped).
 *
 * The dangerous-member-access guard applies to the whole source, so a blocked
 * access in any statement blocks the handler. An ahead-of-time compiled
 * statement-list entry (the `statements` map of `registerCompiledExpressions`,
 * keyed by the full source) takes precedence. Expression entries are never
 * used for a statement list; a single-expression handler goes through
 * {@link evaluateRaw} and so still uses an expression entry, if registered.
 *
 * @security **WARNING:** Uses dynamic code execution. See {@link evaluate} for security notes.
 * @internal
 */
export const evaluateStatements = <T = unknown>(source: string, context: BindingContext): T => {
  try {
    const compiled = getCompiledStatements(source);
    if (compiled) {
      return compiled(context) as T;
    }

    let fn = statementsCache.get(source);
    if (!fn) {
      const statements = splitTopLevel(source, ';');
      if (statements.length < 2 && !STATEMENT_START.test(statements[0] ?? '')) {
        // No statement list: identical to a plain expression (same cache,
        // same expression-registry lookup, same error reporting).
        const expression = statements[0] === source.trim() ? source : (statements[0] ?? '');
        fn = (ctx) => (expression ? evaluateRaw(expression, ctx) : undefined);
      } else {
        const last = statements.pop() as string;
        const tail = STATEMENT_START.test(last) ? `${last};` : `return (${last});`;
        // The guard checks the whole source, so it covers every statement.
        const body = compileGuarded(source, `${statements.join(';\n')};\n${tail}`);
        fn = (ctx) => body(createHardenedContext(ctx));
      }
      statementsCache.set(source, fn);
    }
    return fn(context) as T;
  } catch (error) {
    console.error(`bQuery view: Error evaluating "${source}"`, error);
    return undefined as T;
  }
};

/**
 * Logs a runtime evaluation error, pointing at `bq-on` when the expression is
 * a `;`-separated statement list (only event handlers accept those).
 * @internal
 */
const reportEvaluationError = (expression: string, error: unknown): void => {
  console.error(
    `bQuery view: Error evaluating "${expression}"${
      splitTopLevel(expression, ';').length > 1
        ? ' — ";"-separated statements are only supported in bq-on event handlers'
        : ''
    }`,
    error
  );
};

/**
 * Memoized front-end for {@link parseObjectExpression}. Object expressions are
 * static template attribute values, so each distinct string only needs to be
 * scanned once — bq-for row clones re-bind the same expression per row.
 * Callers must treat the returned record as read-only.
 * @internal
 */
const parsedObjectExpressions = new Map<string, Record<string, string>>();

export const parseObjectExpressionCached = (expression: string): Record<string, string> => {
  let parsed = parsedObjectExpressions.get(expression);
  if (!parsed) {
    // Same bound as the compiled-expression caches; the set of distinct
    // object expressions in an app is small, this only guards degenerate use.
    if (parsedObjectExpressions.size >= MAX_CACHE_SIZE) {
      parsedObjectExpressions.clear();
    }
    parsed = parseObjectExpression(expression);
    parsedObjectExpressions.set(expression, parsed);
  }
  return parsed;
};
