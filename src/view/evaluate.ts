import { isComputed, isSignal, type Signal } from '../reactive/index';
import type { BindingContext } from './types';

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
    if (value !== undefined) {
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
};

/**
 * Creates a proxy that lazily unwraps signals/computed only when accessed.
 * This avoids subscribing to signals that aren't referenced in the expression.
 * @internal
 */
const createLazyContext = (context: BindingContext): BindingContext =>
  new Proxy(context, {
    get(target, prop: string | symbol) {
      // Only handle string keys for BindingContext indexing
      if (typeof prop !== 'string') {
        return Reflect.get(target, prop);
      }
      const value = target[prop];
      // Auto-unwrap signals/computed only when actually accessed
      if (isSignal(value) || isComputed(value)) {
        return (value as Signal<unknown>).value;
      }
      return value;
    },
    has(target, prop: string | symbol) {
      // Required for `with` statement to resolve identifiers correctly
      if (typeof prop !== 'string') {
        return Reflect.has(target, prop);
      }
      return prop in target;
    },
  });

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

    // Use cached function or compile and cache a new one
    let fn = evaluateCache.get(expression);
    if (!fn) {
      // Use `with` to enable direct property access from proxy scope.
      // Note: `new Function()` runs in non-strict mode, so `with` is allowed.
      fn = new Function('$ctx', `with($ctx) { return (${expression}); }`) as (
        ctx: BindingContext
      ) => unknown;
      evaluateCache.set(expression, fn);
    }
    return fn(lazyContext) as T;
  } catch (error) {
    console.error(`bQuery view: Error evaluating "${expression}"`, error);
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
    // Use cached function or compile and cache a new one
    let fn = evaluateRawCache.get(expression);
    if (!fn) {
      // Use `with` to enable direct property access from context scope.
      // Unlike `evaluate`, we don't use a lazy proxy - values are accessed directly.
      fn = new Function('$ctx', `with($ctx) { return (${expression}); }`) as (
        ctx: BindingContext
      ) => unknown;
      evaluateRawCache.set(expression, fn);
    }
    return fn(context) as T;
  } catch (error) {
    console.error(`bQuery view: Error evaluating "${expression}"`, error);
    return undefined as T;
  }
};

/**
 * Parses object expression like "{ active: isActive, disabled: !enabled }".
 * Handles nested structures like function calls, arrays, and template literals.
 * @internal
 */
export const parseObjectExpression = (expression: string): Record<string, string> => {
  const result: Record<string, string> = {};

  // Remove outer braces and trim
  const inner = expression
    .trim()
    .replace(/^\{|\}$/g, '')
    .trim();
  if (!inner) return result;

  // Split by comma at depth 0, respecting strings and nesting
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inString: string | null = null;

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];

    // Handle string literals: count consecutive backslashes before a quote
    // to correctly distinguish escaped quotes from end-of-string
    if ((char === '"' || char === "'" || char === '`')) {
      let backslashCount = 0;
      let j = i - 1;
      while (j >= 0 && inner[j] === '\\') {
        backslashCount++;
        j--;
      }
      // Quote is escaped only if preceded by an odd number of backslashes
      if (backslashCount % 2 === 0) {
        if (inString === null) {
          inString = char;
        } else if (inString === char) {
          inString = null;
        }
      }
      current += char;
      continue;
    }

    // Skip if inside string
    if (inString !== null) {
      current += char;
      continue;
    }

    // Track nesting depth for parentheses, brackets, and braces
    if (char === '(' || char === '[' || char === '{') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      // Top-level comma - split point
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last part
  if (current.trim()) {
    parts.push(current.trim());
  }

  // Parse each part to extract key and value
  for (const part of parts) {
    // Find the first colon at depth 0 (to handle ternary operators in values)
    let colonIndex = -1;
    let partDepth = 0;
    let partInString: string | null = null;

    for (let i = 0; i < part.length; i++) {
      const char = part[i];

      if ((char === '"' || char === "'" || char === '`')) {
        let backslashCount = 0;
        let j = i - 1;
        while (j >= 0 && part[j] === '\\') {
          backslashCount++;
          j--;
        }
        if (backslashCount % 2 === 0) {
          if (partInString === null) {
            partInString = char;
          } else if (partInString === char) {
            partInString = null;
          }
        }
        continue;
      }

      if (partInString !== null) continue;

      if (char === '(' || char === '[' || char === '{') {
        partDepth++;
      } else if (char === ')' || char === ']' || char === '}') {
        partDepth--;
      } else if (char === ':' && partDepth === 0) {
        colonIndex = i;
        break;
      }
    }

    if (colonIndex > -1) {
      const key = part
        .slice(0, colonIndex)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      const value = part.slice(colonIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
};
